import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
// shortcut: the owned fixtures have no quoted delimiters or embedded line breaks; use a CSV parser if that changes.
const fixture = name => readFileSync(new URL(`public/examples/content-${name}.csv`, root), 'utf8').trimEnd().split('\n').slice(1).map(line => line.split(','));

test('lookup fixture: first, last, near-end, and missing raw text keys', () => {
  const rows = fixture('xlookup');
  const first = key => rows.find(row => row[0] === key)?.[1] ?? 'Not found';
  const last = key => rows.findLast(row => row[0] === key)?.[1] ?? 'Not found';
  assert.equal(first('00124'), '24');
  assert.equal(last('00124'), '26');
  assert.equal(first('00125'), '31');
  assert.equal(first('00999'), 'Not found');
  assert.notEqual(first('124'), '24');
});

test('FILTER fixture: one condition, AND rejection, OR overlap, no matches', () => {
  const rows = fixture('filter');
  const ids = selected => selected.map(row => row[0]);
  assert.deepEqual(ids(rows.filter(row => row[1] === 'East')), ['O-101','O-103']);
  assert.deepEqual(ids(rows.filter(row => row[2] === 'Open' && Number(row[3]) >= 8)), ['O-102','O-104']);
  assert.deepEqual(ids(rows.filter(row => row[1] === 'East' || row[1] === 'North')), ['O-101','O-103','O-104']);
  assert.deepEqual(ids(rows.filter(row => row[1] === 'East' || row[2] === 'Open')), ['O-101','O-102','O-103','O-104']);
  assert.deepEqual(rows.filter(row => row[1] === 'South'), []);
});

test('CSV preservation fixture: exact strings and unresolved ambiguous dates', () => {
  const rows = fixture('import');
  assert.deepEqual(rows.map(row => row[0]), ['00123','00007','123456789012345678','001E5']);
  assert.equal(rows[0][0].length, 5);
  assert.equal(rows[2][0].length, 18);
  assert.equal(rows[0][1], '03/04/2026');
  assert.equal(rows[3][1], '04/03/2026');
  const [year,month,day] = rows[1][1].split('-').map(Number);
  assert.deepEqual([year,month,day], [2026,10,24]);
});

test('duplicate fixture: raw keep-first keys, source rows, counts and totals', () => {
  const rows = fixture('duplicates');
  const keep = columns => {
    const seen = new Set();
    return rows.flatMap((row,index) => {
      const key = JSON.stringify(columns.map(column => row[column]));
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ row, sourceRow: index + 2 }];
    });
  };
  const all = keep([0,1,2,3]);
  const ids = keep([0]);
  assert.deepEqual(all.map(item => item.sourceRow), [2,4,5,6,7]);
  assert.deepEqual(ids.map(item => item.sourceRow), [2,4,6]);
  const sum = records => records.reduce((total,row) => total + Number(row[2]), 0);
  assert.equal(sum(rows), 139);
  assert.equal(sum(all.map(item => item.row)), 119);
  assert.equal(sum(ids.map(item => item.row)), 67);
  assert.notEqual(rows[4][1], rows[5][1]);
  assert.equal(rows[4][1].toLowerCase(), rows[5][1].toLowerCase());
  assert.deepEqual(rows.map((row,index) => rows.slice(0,index+1).filter(other => other[0] === row[0]).length), [1,2,1,2,1,2]);
});

test('date interval oracle: next month, timestamp end trap, and day interval', () => {
  const rows = fixture('sumifs').map(([stamp,amount,channel]) => ({ time: Date.parse(`${stamp}Z`), amount: Number(amount), channel }));
  assert.ok(rows.every(row => Number.isFinite(row.time) && Number.isFinite(row.amount)));
  const start = Date.UTC(2026,9,1), next = Date.UTC(2026,10,1), lastDay = Date.UTC(2026,9,31);
  const sum = predicate => rows.filter(predicate).reduce((total,row) => total + row.amount,0);
  assert.equal(sum(row => row.time >= start && row.time < next),85);
  assert.equal(sum(row => row.time >= start && row.time < next && row.channel === 'Web'),60);
  assert.equal(sum(row => row.time >= start && row.time <= lastDay),55);
  assert.equal(sum(row => row.time >= lastDay && row.time < next),50);
  assert.equal(rows.filter(row => row.time === next)[0].amount,200);
});

test('compatibility fixture: matching/empty sets, array values and lookups', () => {
  const rows = fixture('compatibility');
  assert.deepEqual(rows.filter(row => row[1] === 'East' && Number(row[2]) >= 5), [['Clip','East','9']]);
  assert.deepEqual(rows.filter(row => row[1] === 'South'), []);
  assert.deepEqual(rows.map(row => Number(row[2])*2), [6,14,18,10]);
  assert.equal(rows.find(row => row[0] === 'Clip')?.[2], '9');
  assert.equal(rows.find(row => row[0] === 'Tape')?.[2] ?? 'Missing', 'Missing');
});


test('COUNTIF/COUNTIFS practice CSV matches the approved five-row visual and every worked total', () => {
  const source = readFileSync(new URL('public/examples/countif-countifs-five-orders.csv',root),'utf8');
  assert.equal(source.split('\n')[0], 'Region,Status,Value');
  const rows = fixture('countif-countifs-five-orders');
  assert.deepEqual(rows, [
    ['East','Paid','120'],
    ['West','Paid','90'],
    ['East','Open','200'],
    ['East','Paid','50'],
    ['West','Open','75'],
  ]);
  const count = predicate => rows.filter(predicate).length;
  assert.equal(count(row => row[0] === 'East'),3);
  assert.equal(count(row => row[1] === 'Paid'),3);
  assert.equal(count(row => row[0] === 'East' && row[1] === 'Paid'),2);
  assert.equal(count(row => row[0] === 'East' && row[1] === 'Paid' && Number(row[2])>=100),1);
  assert.equal(count(row => row[0] === 'East' || row[0] === 'West'),5);
  assert.equal(count(row => row[0] === 'East' && row[0] === 'West'),0);
  const svg=readFileSync(new URL('public/visuals/countif-vs-countifs-row-matches.svg',root),'utf8');
  assert.match(svg,/East appears in three rows/);
  assert.match(svg,/Region East and status Paid occur together in only two rows/);
  assert.match(svg,/Result: 3 rows/);
  assert.match(svg,/Result: 2 rows/);
});

test('launch guides and new Notion publications carry appropriate evidence', () => {
  const directory = new URL('src/content/articles/', root);
  const names = readdirSync(directory).filter(name => name.endsWith('.md'));
  const launchGuides = new Set([
    'excel-vs-google-sheets-formulas.md',
    'google-sheets-filter-examples.md',
    'import-csv-preserve-zeros-dates.md',
    'remove-duplicate-rows.md',
    'sumifs-with-dates.md',
    'xlookup-not-working.md',
  ]);
  for (const name of launchGuides) assert.ok(names.includes(name), 'Missing launch guide: ' + name);
  assert.ok(names.length >= launchGuides.size);
  for (const name of names) {
    const content = readFileSync(new URL(name,directory),'utf8');
    assert.match(content,/^sources: \[\{/m);
    assert.match(content,/^draft: false$/m);
    assert.match(content,/^## /m);
    assert.ok(!content.includes('[INTERNAL-LINK:'));
    if (launchGuides.has(name)) {
      assert.match(content,/Native Excel and Google Sheets execution not performed/);
      assert.match(content,/^publishedDate: "2026-10-24"$/m);
      const downloads = [...content.matchAll(/\]\((\/examples\/content-[^)]+)\)/g)];
      assert.ok(downloads.length > 0);
      for (const [,filePath] of downloads) assert.ok(readFileSync(new URL('public' + filePath,root)).length > 0);
      const report = readFileSync(new URL('docs/quality/' + name,root),'utf8');
      for (const heading of ['search intent','sources/date/claims','distinct contribution','prior lessons applied','corrections','unverified','postpublication URL currently pending','next improvements']) {
        assert.ok(report.includes('## ' + heading));
      }
    } else {
      // Dynamically published articles need their own provenance; the six fixture requirements do not apply.
      assert.match(content,/^notionPageId: "[0-9a-f-]{36}"$/m);
      assert.match(content,/^publishedDate: "\d{4}-\d{2}-\d{2}"$/m);
      assert.match(content,/^verification: ".*does not establish native Excel or Google Sheets execution\."$/m);
      assert.match(content,/^author: "GuideHollow Sheets Editorial"$/m);
    }
  }
});
