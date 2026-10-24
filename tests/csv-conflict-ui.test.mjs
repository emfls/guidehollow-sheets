import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');

test('csv results explain conflicting selected-key values before export',()=>{
  const page=read('src/pages/tools/csv-duplicate-checker.astro');
  assert.match(page,/id="csv-conflicts"/);
  assert.match(page,/id="csv-conflict-table"/);
  assert.match(page,/id="csv-conflict-ack"/);
  assert.match(page,/I have compared the changed values/);
});

test('download remains blocked until conflict and formula warnings are acknowledged',()=>{
  const script=read('src/scripts/csv-tool.ts');
  assert.match(script,/conflictingDuplicates\(data, found\.duplicates\)/);
  assert.match(script,/changed\.map\(column => conflictHeadings\[column\]\)/);
  assert.match(script,/conflictCount > 0 && !conflictAck\.checked/);
  assert.match(script,/conflictAck\.addEventListener\('change', refreshDownload\)/);
  assert.match(script,/resetConflicts\(\)/);
});
 
test('all conflict rows are available by page with changed original values, not only 10 summaries',()=>{
  const page=read('src/pages/tools/csv-duplicate-checker.astro');
  const script=read('src/scripts/csv-tool.ts');
  for(const id of ['csv-conflict-page','csv-conflict-pages','csv-conflict-prev','csv-conflict-next']){
    assert.ok(page.includes('id="'+id+'"'),id);
  }
  assert.match(page,/I have compared the changed values below/);
  assert.match(script,/const CONFLICT_PAGE_SIZE = 10/);
  assert.match(script,/conflictItems\.slice\(start, start \+ CONFLICT_PAGE_SIZE\)/);
  assert.match(script,/conflictSource\[item\.firstIndex\]\[column\]/);
  assert.match(script,/conflictSource\[item\.index\]\[column\]/);
  assert.match(script,/Kept values \(same column order\)/);
  assert.match(script,/Removed values \(same column order\)/);
  assert.match(script,/Conflicting rows \$\{start \+ 1\}/);
  assert.match(script,/conflictPrevious\.addEventListener\('click'/);
  assert.match(script,/conflictNext\.addEventListener\('click'/);
  assert.match(script,/conflictPager\.hidden = true/);
  assert.match(script,/target\.replaceChildren\(\)/);
  assert.match(script,/line\.insertCell\(\)\.textContent = value/);
});
