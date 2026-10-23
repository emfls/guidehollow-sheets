import test from 'node:test';
import assert from 'node:assert/strict';
import { formulas, filterFormulas } from '../src/lib/formulas.ts';

test('every curated function has product syntax, examples, provenance, inputs, outputs and limits', () => {
  assert.equal(formulas.length, 8);
  assert.equal(new Set(formulas.map(item => item.name)).size, formulas.length);
  for (const item of formulas) {
    for (const value of Object.values(item)) assert.ok(typeof value === 'string' && value.length > 0);
    assert.ok(item.excelExample.startsWith('=' + item.name + '('));
    assert.ok(item.sheetsExample.startsWith('=' + item.name + '('));
    assert.equal(new URL(item.excelSource).hostname, 'support.microsoft.com');
    assert.equal(new URL(item.sheetsSource).hostname, 'support.google.com');
  }
});
test('search trims whitespace, ignores case, and combines with task filtering', () => {
  assert.deepEqual(filterFormulas('  xlookup ').map(item => item.name), ['XLOOKUP']);
  assert.deepEqual(filterFormulas('', 'Clean text').map(item => item.name), ['TRIM', 'LEFT']);
  assert.deepEqual(filterFormulas('clean').map(item => item.name), ['TRIM', 'LEFT']);
  assert.deepEqual(filterFormulas('deduplicate').map(item => item.name), ['FILTER', 'UNIQUE']);
  assert.equal(filterFormulas('SUMIFS', 'Clean text').length, 0);
  assert.equal(filterFormulas('no-such-formula').length, 0);
  assert.equal(filterFormulas('').length, 8);
});
test('FILTER product differences and Excel availability caveats are explicit', () => {
  const filter = formulas.find(item => item.name === 'FILTER');
  assert.equal(filter.excelExample, '=FILTER(A2:B4,B2:B4>=10,"No matches")');
  assert.equal(filter.sheetsExample, '=FILTER(A2:B4,B2:B4>=10)');
  assert.match(filter.limits, /#N\/A/);
  assert.match(formulas.find(item => item.name === 'XLOOKUP').limits, /2016\/2019 do not support/);
});
// These narrow JavaScript oracles check only the displayed fixtures, not spreadsheet engines.
test('sample fixture arithmetic, selection and text results agree with static expected outputs', () => {
  const fixtureResults = {
    SUMIFS: String([['East','Paid',20], ['West','Paid',30], ['East','Paid',15]].filter(row => row[0] === 'East' && row[1] === 'Paid').reduce((sum, row) => sum + row[2], 0)),
    COUNTIFS: String([['East',20], ['West',30], ['East',5]].filter(row => row[0] === 'East' && row[1] >= 10).length),
    XLOOKUP: [['P01','Pen'], ['P02','Notebook'], ['P03','Clip']].find(row => row[0] === 'P02')[1],
    IFERROR: 0 === 0 ? 'Check divisor' : String(10 / 0),
    TRIM: '  Ada   Lovelace  '.replace(/^ +| +$/g, '').replace(/ +/g, ' '),
    LEFT: 'INV-2048'.slice(0,3),
  };
  for (const [name, output] of Object.entries(fixtureResults)) assert.equal(formulas.find(item => item.name === name).output, output);
  assert.deepEqual([['Pen',8],['Book',15],['Clip',12]].filter(row => row[1] >= 10), [['Book',15],['Clip',12]]);
  assert.equal(formulas.find(item => item.name === 'FILTER').output, 'Two rows: Book | 15; Clip | 12.');
  assert.deepEqual([...new Set(['Pen','Book','Pen','Clip'])], ['Pen','Book','Clip']);
  assert.equal(formulas.find(item => item.name === 'UNIQUE').output, 'Three rows: Pen; Book; Clip.');
});
