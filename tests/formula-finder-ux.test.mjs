import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');

test('formula shortcuts match actual task groups',()=>{
 const page=read('src/pages/tools/formula-finder.astro');
 const formulas=read('src/lib/formulas.ts');
 for(const task of ['Look up data','Sum and count','Filter and deduplicate','Clean text']){
   assert.ok(page.includes('data-quick-task="'+task+'"'));
   assert.ok(formulas.includes("task: '"+task+"'"));
 }
 assert.match(page,/What would you like to do\?/);
 assert.match(page,/id="formula-clear"/);
 assert.match(page,/tabindex="-1"/);
});

test('shortcuts update filters and focus an actual result',()=>{
 const script=read('src/scripts/formula-finder.ts');
 assert.match(script,/button\.dataset\.quickTask/);
 assert.match(script,/task\.value =/);
 assert.match(script,/query\.value = ''/);
 assert.match(script,/cards\.find\(card => !card\.hidden\)/);
 assert.match(script,/\?\.focus\(\)/);
 assert.match(script,/form\.reset\(\)/);
 assert.match(script,/selection\.addRange\(range\)/);
});

test('direct examples link to four existing original guides',()=>{
 const page=read('src/pages/tools/formula-finder.astro');
 for(const [slug,href] of [
  ['sumifs-with-dates','/formulas/sumifs-with-dates/'],
  ['xlookup-not-working','/troubleshooting/xlookup-not-working/'],
  ['google-sheets-filter-examples','/formulas/google-sheets-filter-examples/'],
  ['iferror-vs-ifna-excel-google-sheets','/formulas/iferror-vs-ifna-excel-google-sheets/']
 ]) {
  assert.ok(page.includes(href),href);
  assert.ok(read('src/content/articles/'+slug+'.md').includes('slug: "'+slug+'"'),slug);
 }
});
