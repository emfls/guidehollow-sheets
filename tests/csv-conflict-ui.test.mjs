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
  assert.match(page,/I reviewed the different column values/);
});

test('download remains blocked until conflict and formula warnings are acknowledged',()=>{
  const script=read('src/scripts/csv-tool.ts');
  assert.match(script,/conflictingDuplicates\(data, found\.duplicates\)/);
  assert.match(script,/differingColumns\.map\(column => headings\[column\]\)/);
  assert.match(script,/conflictCount > 0 && !conflictAck\.checked/);
  assert.match(script,/conflictAck\.addEventListener\('change', refreshDownload\)/);
  assert.match(script,/resetConflicts\(\)/);
});
