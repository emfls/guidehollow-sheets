export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 20000;
export const MAX_COLUMNS = 200;
export type CSVRow = string[];

/** Strict comma-separated UTF-8 CSV. One optional final record separator is ignored. */
export function parseCSV(source: string): CSVRow[] {
  if (new TextEncoder().encode(source).length > MAX_BYTES) throw new Error('CSV exceeds the 2 MiB limit. Split it into smaller files.');
  const text = source.replace(/^\uFEFF/, '');
  if (!text) throw new Error('CSV is empty. Add a header and at least one data row.');
  const rows: CSVRow[] = [];
  let row: CSVRow = [], value = '', quoted = false, closed = false;
  const field = () => { row.push(value); value = ''; closed = false; if (row.length > MAX_COLUMNS) throw new Error('CSV exceeds the 200-column limit.'); };
  const record = () => {
    field();
    if (rows.length && row.length !== rows[0].length) throw new Error(`Record ${rows.length + 1} has ${row.length} columns; expected ${rows[0].length}. Check commas and quotes.`);
    rows.push(row); row = [];
    if (rows.length > MAX_ROWS + 1) throw new Error('CSV exceeds the 20,000 data-row limit. Split it into smaller files.');
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else value += c;
    } else if (c === ',') field();
    else if (c === '\r' || c === '\n') { record(); if (c === '\r' && text[i + 1] === '\n') i++; }
    else if (c === '"' && !value && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error(`Invalid quote in record ${rows.length + 1}. Quote the whole field and double any embedded quotes.`);
      value += c;
    }
  }
  if (quoted) throw new Error(`Unclosed quoted field in record ${rows.length + 1}. Add its closing double quote.`);
  if (value || row.length || closed || !/[\r\n]$/.test(text)) record();
  return rows;
}

export function stringifyCSV(rows: readonly (readonly string[])[]): string {
  return rows.map(row => row.map(value => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join(',')).join('\r\n') + '\r\n';
}

/** Indexes are zero-based data-row indexes; a header is never implicitly removed. */
export function findDuplicates(rows: readonly CSVRow[], columns?: readonly number[]) {
  const width = rows[0]?.length ?? 0;
  const keys = columns ?? Array.from({ length: width }, (_, i) => i);
  if (!keys.length || keys.some(i => !Number.isInteger(i) || i < 0 || i >= width)) throw new Error('Select at least one valid key column.');
  const first = new Map<string, number>();
  const kept: CSVRow[] = [], duplicates: { index: number; firstIndex: number; row: CSVRow }[] = [];
  rows.forEach((row, index) => {
    if (row.length !== width) throw new Error('All rows must have the same number of columns.');
    const key = JSON.stringify(keys.map(i => row[i]));
    const firstIndex = first.get(key);
    if (firstIndex === undefined) { first.set(key, index); kept.push(row); }
    else duplicates.push({ index, firstIndex, row });
  });
  return { kept, duplicates, before: rows.length, after: kept.length, removed: duplicates.length };
}

export function hasFormulaRisk(value: string): boolean {
  return /^[\s\uFEFF]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value);
}
