import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../src/pages/[category]/[slug].astro',import.meta.url),'utf8');
const ifna=readFileSync(new URL('../public/visuals/iferror-vs-ifna-flow.svg',import.meta.url),'utf8');
const xlookup=readFileSync(new URL('../public/visuals/xlookup-first-match.svg',import.meta.url),'utf8');
const article=readFileSync(new URL('../src/content/articles/iferror-vs-ifna-excel-google-sheets.md',import.meta.url),'utf8');

test('formula diagrams are accessible and grounded in example data',()=>{
  assert.match(page,/<img src=\{visual.src\} alt=\{visual.alt\}/);
  assert.match(page,/<figcaption>/);
  assert.match(page,/iferror-vs-ifna-flow\.svg/);
  assert.match(page,/xlookup-first-match\.svg/);
  for(const svg of [ifna,xlookup]){
    assert.match(svg,/<title id="title">/);
    assert.match(svg,/<desc id="desc">/);
    assert.ok(svg.length < 25_000);
  }
  assert.match(ifna,/#REF!/);
  assert.match(xlookup,/00124/);
});

test('newly published article has readable inline formula emphasis',()=>{
  assert.doesNotMatch(article,/\*\*\*\*/);
  assert.match(article,/\*\*Use `IFNA` when a missing lookup match/);
});
