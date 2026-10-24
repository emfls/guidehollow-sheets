/**
 * Deterministic real-Chromium CSV smoke test of the built AND deployed site.
 * No NPM/browser automation dependencies or CSV upload/export operations.
 * Uses Chrome DevTools Protocol to inspect true DOM properties and click behavior.
 */
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const outputRoot = path.resolve('dist');
const target = process.env.CSV_BROWSER_TARGET ?? 'built';
assert.ok(['built','production'].includes(target), 'CSV_BROWSER_TARGET must be built or production');
let server;
let chrome;
let socket;
let profile;

function executable() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    if (spawnSync('which', [name], {encoding:'utf8'}).status === 0) return name;
  }
  throw new Error('Chrome/Chromium unavailable: install browser or set CHROME_BIN');
}

async function startStaticServer() {
  const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
    '.svg':'image/svg+xml','.json':'application/json'};
  server = createServer(async (req,res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const filePath = path.resolve(outputRoot, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
      if (!filePath.startsWith(outputRoot + path.sep)) {res.writeHead(403).end(); return;}
      const bytes = await readFile(filePath);
      res.writeHead(200, {'Content-Type':mime[path.extname(filePath)] ?? 'application/octet-stream'});
      res.end(bytes);
    } catch {
      res.writeHead(404, {'Content-Type':'text/plain'}).end('Not found');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port;
}

async function startChrome() {
  profile = await mkdtemp(path.join(tmpdir(), 'sheets-csv-browser-'));
  chrome = spawn(executable(), ['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--no-first-run','--no-default-browser-check','--remote-debugging-port=0',
    '--user-data-dir=' + profile,'about:blank'], {stdio:'ignore'});
  let activePort;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (chrome.exitCode !== null) throw new Error('Chrome exited before opening debugging port');
    try {activePort = await readFile(path.join(profile,'DevToolsActivePort'), 'utf8'); break;}
    catch {await delay(100);}
  }
  assert(activePort, 'Chrome did not open its DevTools port');
  const [port, endpoint] = activePort.trim().split('\n');
  socket = new WebSocket('ws://127.0.0.1:' + port + endpoint);
  await new Promise((resolve,reject) => {
    socket.addEventListener('open',resolve,{once:true});
    socket.addEventListener('error',reject,{once:true});
  });

  let sequence = 0;
  const pending = new Map();
  const requests = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Network.requestWillBeSent') {
      requests.push({url:message.params.request.url,method:message.params.request.method});
    }
    if (!message.id) return;
    const pair = pending.get(message.id);
    if (!pair) return;
    pending.delete(message.id);
    if (message.error) pair.reject(new Error(message.error.message));
    else pair.resolve(message.result);
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve,reject) => {
      const id = ++sequence;
      pending.set(id,{resolve,reject});
      socket.send(JSON.stringify({id,method,params,...(sessionId ? {sessionId} : {})}));
    });
  }
  const {targetId} = await send('Target.createTarget', {url:'about:blank'});
  const {sessionId} = await send('Target.attachToTarget', {targetId,flatten:true});
  await send('Runtime.enable',{},sessionId);
  await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId);
  async function evaluate(code) {
    const result = await send('Runtime.evaluate', {expression:'(function(){' + code + '})()',
      returnByValue:true,awaitPromise:true},sessionId);
    if (result.exceptionDetails) throw new Error('Browser evaluation failed: ' + JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  return {send:(method,params)=>send(method,params,sessionId), evaluate, requests};
}

async function run() {
  // 'built' uses local dist files. 'production' navigates to the public Pages URL,
  // after deployment, to independently observe actual live DOM and event behavior.
  const base = target === 'production'
    ? 'https://sheets.guidehollow.com'
    : await startStaticServer();
  const page = await startChrome();
  await page.send('Page.navigate', {url:base + '/tools/csv-duplicate-checker/'});
  let ready = false;
  for(let i=0;i<200;i++) {
    ready = await page.evaluate("return document.readyState === 'complete' && !!document.querySelector('#csv-load');");
    if (ready) break;
    await delay(100);
  }
  assert(ready, `CSV tool did not load from ${base}`);
  assert.equal(await page.evaluate('return location.origin;'),base, 'Navigated to wrong browser origin');

  // Real DOM assertions before any CSV is read, including a forged click event
  // that deliberately bypasses normal disabled-button browser dispatch.
  const beforeRead = await page.evaluate([
    "const button = document.querySelector('#csv-download');",
    "const before = document.querySelector('#csv-status').textContent;",
    "button.click();",
    "button.dispatchEvent(new MouseEvent('click',{bubbles:true}));",
    "return {disabled:button.disabled,resultsHidden:document.querySelector('#csv-results').hidden,",
    "  conflictHidden:document.querySelector('#csv-conflict-ack-row').hidden,",
    "  statusUnchanged:document.querySelector('#csv-status').textContent===before};"
  ].join('\n'));
  assert.deepEqual(beforeRead,{disabled:true,resultsHidden:true,conflictHidden:true,statusUnchanged:true},
    'Both native and synthetic premature download clicks must be inert');

  const initial = await page.evaluate([
    "const input = document.querySelector('#csv-input');",
    "input.value = ['id,price', ...Array.from({length:12},(_,i)=>'001,'+(i+1))].join('\\n');",
    "input.dispatchEvent(new Event('input',{bubbles:true}));",
    "document.querySelector('#csv-load').click();",
    "const mode=document.querySelector('#csv-mode');",
    "mode.value='selected'; mode.dispatchEvent(new Event('change',{bubbles:true}));",
    "const checks=[...document.querySelectorAll('#csv-columns input')];",
    "if(checks.length !== 2) throw new Error('Expected exactly two CSV key choices');",
    "checks[1].checked=false; checks[1].dispatchEvent(new Event('change',{bubbles:true}));",
    "document.querySelector('#csv-check').click();",
    "return {warning:document.querySelector('#csv-conflicts').textContent,",
    "  page:document.querySelector('#csv-conflict-page').textContent,",
    "  hidden:document.querySelector('#csv-conflict-ack-row').hidden,",
    "  computedDisplay:getComputedStyle(document.querySelector('#csv-conflict-ack-row')).display,",
    "  disabled:document.querySelector('#csv-conflict-ack').disabled,",
    "  checked:document.querySelector('#csv-conflict-ack').checked,",
    "  downloadDisabled:document.querySelector('#csv-download').disabled,",
    "  reportShown:!document.querySelector('#csv-conflict-report-row').hidden};"
  ].join('\n'));
  assert.match(initial.warning,/11 row\(s\)/);
  assert.match(initial.page,/page 1 of 2/);
  assert.equal(initial.hidden,true,'Approval row must be hidden before last page is opened');
  assert.equal(initial.computedDisplay,'none','CSS must not override hidden attribute');
  assert.equal(initial.disabled,true,'Approval checkbox must be disabled before review');
  assert.equal(initial.checked,false);
  assert.equal(initial.downloadDisabled,true);
  assert.equal(initial.reportShown,true);

  const early = await page.evaluate([
    "document.querySelector('#csv-conflict-ack').click();",
    "document.querySelector('#csv-ack').click();",
    "return {conflictChecked:document.querySelector('#csv-conflict-ack').checked,",
    "downloadDisabled:document.querySelector('#csv-download').disabled};"
  ].join('\n'));
  assert.equal(early.conflictChecked,false,'Must not accept a premature conflict consent');
  assert.equal(early.downloadDisabled,true,'Download must remain blocked with only formula-risk consent');

  const visited = await page.evaluate([
    "document.querySelector('#csv-conflict-next').click();",
    "const cells=[...document.querySelectorAll('#csv-conflict-table tbody tr:first-child td')].map(x=>x.textContent);",
    "return {page:document.querySelector('#csv-conflict-page').textContent,cells,",
    "  hidden:document.querySelector('#csv-conflict-ack-row').hidden,",
    "  disabled:document.querySelector('#csv-conflict-ack').disabled,",
    "  checked:document.querySelector('#csv-conflict-ack').checked,",
    "  downloadDisabled:document.querySelector('#csv-download').disabled};"
  ].join('\n'));
  assert.match(visited.page,/page 2 of 2/);
  assert.equal(visited.cells[0],'2');
  assert.equal(visited.cells[1],'13');
  assert.equal(visited.cells[3],'"1"');
  assert.equal(visited.cells[4],'"12"');
  assert.equal(visited.hidden,false);
  assert.equal(visited.disabled,false);
  assert.equal(visited.checked,false);
  assert.equal(visited.downloadDisabled,true,'Page visit alone does not equal consent');

  const accepted = await page.evaluate([
    "document.querySelector('#csv-conflict-ack').click();",
    "return {approved:document.querySelector('#csv-conflict-ack').checked,",
    "  downloadDisabled:document.querySelector('#csv-download').disabled};"
  ].join('\n'));
  assert.equal(accepted.approved,true);
  assert.equal(accepted.downloadDisabled,false,'Both deliberate checkboxes should enable local CSV export');

  // Measure mobile browser layout and control dimensions at two phone widths.
  const mobileObservations = [];
  for (const width of [360,390]) {
    await page.send('Emulation.setDeviceMetricsOverride', {width,height:800,deviceScaleFactor:3,mobile:true});
    await page.send('Emulation.setTouchEmulationEnabled', {enabled:true,maxTouchPoints:1});
    const metrics = await page.evaluate([
      "const table=document.querySelector('#csv-conflict-table');",
      "const last=table.querySelector('tbody tr:first-child td:last-child');",
      "const dims=id=>{const r=document.querySelector(id).getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),left:Math.round(r.left),right:Math.round(r.right)};};",
      "table.scrollLeft=table.scrollWidth;",
      "const result={viewport:innerWidth,rootWidth:document.documentElement.scrollWidth,",
      "bodyWidth:document.body.scrollWidth,tableClient:table.clientWidth,tableScroll:table.scrollWidth,",
      "tableOffset:table.scrollLeft,lastColumnRight:Math.round(last.getBoundingClientRect().right),",
      "tableRight:Math.round(table.getBoundingClientRect().right),",
      "menu:dims('#menu-toggle'),read:dims('#csv-load'),check:dims('#csv-check'),",
      "previous:dims('#csv-conflict-prev'),next:dims('#csv-conflict-next'),",
      "download:dims('#csv-download'),report:dims('#csv-conflict-report'),",
      "keyboardFocusTest:document.querySelector('#csv-conflict-prev').tabIndex>=0};",
      "table.scrollLeft=0;return result;"
    ].join('\n'));
    // Prevent any document-wide sideways swipe; the comparison table must
    // be independently scrollable until its final values are visible.
    assert.equal(metrics.viewport,width,'Mobile viewport must honor the width metadata');
    assert.ok(metrics.rootWidth<=width+1 && metrics.bodyWidth<=width+1,
      'Mobile CSV page must not overflow the root viewport');
    assert.ok(metrics.tableScroll>metrics.tableClient && metrics.tableOffset>0,
      'Five-column conflict comparison must scroll independently on phones');
    assert.ok(metrics.lastColumnRight<=metrics.tableRight+2,
      'The last difference column must be reachable by scrolling the table');
    for (const label of ['menu','read','check','previous','next','download','report']) {
      assert.ok(metrics[label].h>=44,label+' must have at least a 44px tall touch target');
    }
    mobileObservations.push(metrics);
  }

  // Send real keyboard events through Chrome, rather than synthesizing clicks
  // in page JavaScript. Verify mobile navigation and conflict review pagination.
  const pressKey=async (key,code,number,modifiers=0)=>{
    await page.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:number,modifiers});
    await page.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:number,modifiers});
  };
  assert.equal(await page.evaluate(
    "document.querySelector('#menu-toggle').focus(); return document.activeElement.id;"),'menu-toggle');
  await pressKey('Enter','Enter',13);
  assert.equal(await page.evaluate(
    "return document.querySelector('#menu-toggle').getAttribute('aria-expanded');"),'true',
    'Keyboard Enter must open the mobile menu');
  assert.equal(await page.evaluate("return document.querySelector('#main-nav').classList.contains('open');"),true);
  await pressKey('Escape','Escape',27);
  assert.equal(await page.evaluate(
    "return document.querySelector('#menu-toggle').getAttribute('aria-expanded');"),'false',
    'Escape must dismiss mobile navigation');

  assert.equal(await page.evaluate(
    "document.querySelector('#csv-conflict-prev').focus(); return document.activeElement.id;"),'csv-conflict-prev');
  await pressKey('Enter','Enter',13);
  assert.match(await page.evaluate("return document.querySelector('#csv-conflict-page').textContent;"),/page 1 of 2/,
    'Keyboard Enter must navigate to previous differences');
  assert.equal(await page.evaluate(
    "document.querySelector('#csv-conflict-next').focus(); return document.activeElement.id;"),'csv-conflict-next');
  await pressKey('Tab','Tab',9);
  assert.equal(await page.evaluate("return document.activeElement.id;"),'csv-conflict-report',
    'Tab from next differences must reach the full-report button');
  await pressKey('Tab','Tab',9,8);
  assert.equal(await page.evaluate("return document.activeElement.id;"),'csv-conflict-next',
    'Shift+Tab must return to the next-differences button');
  await pressKey('Enter','Enter',13);
  assert.match(await page.evaluate("return document.querySelector('#csv-conflict-page').textContent;"),/page 2 of 2/,
    'Keyboard Enter must navigate to next differences');
  await page.send('Emulation.clearDeviceMetricsOverride');
  await page.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  console.log('CSV MOBILE DOM AUDIT ' + JSON.stringify({target,mobileObservations}));
  const invalidated = await page.evaluate([
    "const checks=[...document.querySelectorAll('#csv-columns input')];",
    "checks[1].checked=true; checks[1].dispatchEvent(new Event('change',{bubbles:true}));",
    "return {resultsHidden:document.querySelector('#csv-results').hidden,",
    "  approvalHidden:document.querySelector('#csv-conflict-ack-row').hidden,",
    "  downloadDisabled:document.querySelector('#csv-download').disabled};"
  ].join('\n'));
  assert.deepEqual(invalidated,{resultsHidden:true,approvalHidden:true,downloadDisabled:true},
    'Changing matching keys must erase the previous reviewed/exportable state');

  const changedInput = await page.evaluate([
    "const textarea=document.querySelector('#csv-input');",
    "textarea.value += '\\n001,13';",
    "textarea.dispatchEvent(new Event('input',{bubbles:true}));",
    "return {resultsHidden:document.querySelector('#csv-results').hidden,",
    "  optionsHidden:document.querySelector('#csv-options').hidden,",
    "  approvalHidden:document.querySelector('#csv-conflict-ack-row').hidden,",
    "  downloadDisabled:document.querySelector('#csv-download').disabled};"
  ].join('\n'));
  assert.deepEqual(changedInput,
    {resultsHidden:true,optionsHidden:true,approvalHidden:true,downloadDisabled:true},
    'Editing source CSV must invalidate the prior results, approval and export');

  // Local build can prove this isolated test makes only same-origin GET requests.
  // The public site can load unrelated third-party scripts; avoid conflating their
  // requests with a CSV upload or claiming this is a comprehensive privacy audit.
  if (target === 'built') {
    const httpRequests = page.requests.filter(item => item.url.startsWith('http:') || item.url.startsWith('https:'));
    assert.ok(httpRequests.length > 0,'Expected observable local HTTP requests');
    assert.deepEqual(httpRequests.filter(item => !item.url.startsWith(base + '/')),[],
      'Built CSV exercise must not send requests to external HTTP endpoints');
    assert.deepEqual(httpRequests.filter(item => item.method !== 'GET'),[],
      'Built CSV exercise must not send data using HTTP requests');
  }
  console.log('CSV DOM OBSERVATIONS ' + JSON.stringify({
    target, origin:base, beforeRead, firstPage:initial, prematureConsent:early,
    secondPage:visited, bothConsents:accepted, keysChanged:invalidated,
    sourceChanged:changedInput
  }));
  console.log('PASS: real Chromium DOM confirms 11 differences, locked review, final row, dual consent and reset on ' + target);
}

try {await run();}
catch (error) {console.error('CSV real-browser regression FAILED:',error); process.exitCode=1;}
finally {
  if(socket && socket.readyState === WebSocket.OPEN) socket.close();
  if(chrome) {
    if(chrome.exitCode === null) chrome.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),delay(1800)]);
    if(chrome.exitCode === null) chrome.kill('SIGKILL');
  }
  if(server) await new Promise(resolve=>server.close(resolve));
  if(profile) {
    for(let attempt=0;attempt<8;attempt++) {
      try {await rm(profile,{recursive:true,force:true});break;}
      catch(error){if(attempt===7) console.error('Temporary Chrome profile cleanup failed:',error.message);else await delay(200);}
    }
  }
}
