import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, stringifyCSV, findDuplicates, conflictingDuplicates, hasFormulaRisk, MAX_BYTES, MAX_ROWS, MAX_COLUMNS } from '../src/lib/csv.ts';

test('BOM, CRLF, quoted comma, escaped quotes and multiline records preserve strings', () => {
  assert.deepEqual(parseCSV('\uFEFFid,note\r\n001,"a,b"\r\n002,"say ""hello""\r\nnext"\r\n'), [
    ['id', 'note'], ['001', 'a,b'], ['002', 'say "hello"\r\nnext'],
  ]);
});
test('LF, trailing empty fields and optional final newline', () => {
  assert.deepEqual(parseCSV('a,b\nx,\ny,""'), [['a', 'b'], ['x', ''], ['y', '']]);
  assert.deepEqual(parseCSV('""'), [['']]);
  assert.deepEqual(parseCSV('a\n\n'), [['a'], ['']]);
});
test('UTF-8 decoding leaves BOM handling to the parser and preserves a literal second BOM', () => {
  const decode = text => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(new TextEncoder().encode(text));
  assert.deepEqual(parseCSV(decode('\uFEFFid,name\n001,Ada')), [['id', 'name'], ['001', 'Ada']]);
  assert.deepEqual(parseCSV(decode('\uFEFF\uFEFFid,name\n001,Ada')), [['\uFEFFid', 'name'], ['001', 'Ada']]);
  assert.throws(() => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(new Uint8Array([0xc3, 0x28])), /encoded data/);
});
test('rejects malformed quotes and unequal widths with record context', () => {
  for (const source of ['a\nx"y', 'a\n"x"y', 'a\n"x" ', 'a\n"unclosed']) assert.throws(() => parseCSV(source), /record 2/);
  assert.throws(() => parseCSV('a,b\nx'), /Record 2 has 1 columns; expected 2/);
  assert.throws(() => parseCSV('a,b\nx,y,z'), /expected 2/);
  assert.throws(() => parseCSV(''), /empty/);
});
test('browser protection caps are explicit and enforced', () => {
  assert.throws(() => parseCSV('a'.repeat(MAX_BYTES + 1)), /2 MiB/);
  assert.throws(() => parseCSV('é'.repeat(MAX_BYTES / 2 + 1)), /2 MiB/);
  assert.throws(() => parseCSV(Array(MAX_ROWS + 3).fill('x').join('\n')), /20,000/);
  assert.throws(() => parseCSV(Array(MAX_COLUMNS + 1).fill('x').join(',')), /200-column/);
  assert.equal(parseCSV(Array(MAX_ROWS + 1).fill('x').join('\n')).length, MAX_ROWS + 1);
});
test('CSV serialization round-trips every field without modifying identifiers or formulas', () => {
  const rows = [['id', 'value'], ['001', '=1+1'], ['02', ' a '], ['x', 'comma,"quote"\nline'], ['y', '']];
  const csv = stringifyCSV(rows);
  assert.deepEqual(parseCSV(csv), rows);
  assert.ok(csv.endsWith('\r\n'));
  assert.ok(csv.includes('001,=1+1'));
});
test('all-column matching is exact, keeps first and reports row indexes', () => {
  const rows = [['001','Ada'], ['001','Ada'], ['1','Ada'], ['001','ada'], ['001','Ada ']];
  const result = findDuplicates(rows);
  assert.equal(result.before, 5); assert.equal(result.after, 4); assert.equal(result.removed, 1);
  assert.deepEqual(result.duplicates, [{index:1, firstIndex:0, row:rows[1]}]);
  assert.equal(result.kept[0], rows[0]);
});
test('selected keys remove differing non-key values; tuple encoding avoids collisions', () => {
  const rows = [['001','a'], ['001','b'], ['002','a']];
  assert.deepEqual(findDuplicates(rows, [0]).kept, [rows[0], rows[2]]);
  assert.equal(findDuplicates([['a,b', 'c'], ['a', 'b,c']]).removed, 0);
  assert.equal(findDuplicates([['', 'x'], ['', 'y']], [0]).removed, 1);
  for (const keys of [[], [-1], [2], [0.5]]) assert.throws(() => findDuplicates(rows, keys), /valid key column/);
  assert.throws(() => findDuplicates([['a'], ['a','b']]), /same number/);
});
test('formula-prefix warnings are conservative and never transform input', () => {
  for (const value of ['=SUM(A1)', '+1', '-1', '@SUM(A1)', '  =1', '\ttext', '\rtext', '\ntext']) assert.equal(hasFormulaRisk(value), true, value);
  for (const value of ['001', 'ordinary', 'a=b', "'=1", '']) assert.equal(hasFormulaRisk(value), false, value);
});

test('selected-key duplicates with different non-key values are flagged, exact duplicates are not', () => {
  const rows = [
    ['001', 'Ada', 'East'],
    ['001', 'Ada', 'North'],
    ['002', 'Lin', 'West'],
    ['001', 'Ada', 'East'],
  ];
  const byId = findDuplicates(rows, [0]);
  assert.equal(byId.removed, 2);
  assert.deepEqual(conflictingDuplicates(rows, byId.duplicates), [
    { index: 1, firstIndex: 0, differingColumns: [2] },
  ]);
  assert.deepEqual(conflictingDuplicates(rows, findDuplicates(rows).duplicates), []);
  assert.deepEqual(conflictingDuplicates(rows, []), []);
  assert.throws(() => conflictingDuplicates([], [{ index: 1, firstIndex: 0, row: ['001'] }]), /Missing retained row/);
});
