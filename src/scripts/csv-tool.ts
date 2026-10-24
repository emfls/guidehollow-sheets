import { parseCSV, stringifyCSV, findDuplicates, conflictingDuplicates, hasFormulaRisk, MAX_BYTES, MAX_ROWS, type CSVRow } from '../lib/csv';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = element<HTMLTextAreaElement>('csv-input');
const file = element<HTMLInputElement>('csv-file');
const header = element<HTMLInputElement>('csv-header');
const mode = element<HTMLSelectElement>('csv-mode');
const columns = element<HTMLFieldSetElement>('csv-columns');
const error = element('csv-error'), status = element('csv-status');
const results = element('csv-results'), options = element('csv-options');
const ack = element<HTMLInputElement>('csv-ack'), download = element<HTMLButtonElement>('csv-download');
const conflictWarning = element('csv-conflicts'), conflictTable = element('csv-conflict-table');
const conflictAckRow = element('csv-conflict-ack-row');
const conflictAck = element<HTMLInputElement>('csv-conflict-ack');
let conflictCount = 0;
const resetConflicts = () => {
  conflictCount = 0; conflictWarning.hidden = true; conflictWarning.textContent = '';
  conflictTable.hidden = true; conflictTable.replaceChildren();
  conflictAckRow.hidden = true; conflictAck.checked = false;
};
let rows: CSVRow[] = [], cleaned: CSVRow[] = [];
let revision = 0;
const message = (text: string) => { error.textContent = text; error.hidden = !text; };
const invalidate = () => { revision++; rows = []; cleaned = []; results.hidden = true; options.hidden = true; download.disabled = true; ack.checked = false; resetConflicts(); status.textContent = ''; message(''); };
const invalidateResult = () => { cleaned = []; results.hidden = true; download.disabled = true; ack.checked = false; resetConflicts(); status.textContent = 'Matching options changed. Find duplicates again.'; };
function preview(id: string, data: CSVRow[], headings: string[]) {
  const target = element(id); target.replaceChildren();
  if (!data.length) { target.textContent = 'No rows.'; return; }
  const table = document.createElement('table');
  const caption = table.createCaption(); caption.textContent = `Showing ${Math.min(data.length, 10)} of ${data.length} rows`;
  const tr = table.createTHead().insertRow();
  headings.forEach(label => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; tr.append(th); });
  const body = table.createTBody();
  data.slice(0, 10).forEach(row => { const line = body.insertRow(); row.forEach(value => { line.insertCell().textContent = value; }); });
  target.append(table);
}
input.addEventListener('input', () => { file.value = ''; invalidate(); });
header.addEventListener('change', invalidate);
file.addEventListener('change', async () => {
  invalidate(); input.value = '';
  const current = revision, selected = file.files?.[0];
  if (!selected) return;
  try {
    if (selected.size > MAX_BYTES) throw new Error('File exceeds 2 MiB. Split it into smaller files.');
    const buffer = await selected.arrayBuffer();
    if (current !== revision) return;
    input.value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
    status.textContent = 'UTF-8 file loaded. Choose Read CSV to continue.';
  } catch { if (current === revision) message(selected.size > MAX_BYTES ? 'File exceeds 2 MiB. Split it into smaller files.' : 'Cannot read this file as UTF-8. Re-export it as UTF-8 CSV and try again.'); }
});
element('csv-load').addEventListener('click', () => {
  invalidate();
  try {
    rows = parseCSV(input.value);
    if (rows.length - (header.checked ? 1 : 0) > MAX_ROWS) throw new Error('CSV exceeds the 20,000 data-row limit. Split it into smaller files.');
    const headings = rows[0].map((value, i) => `${i + 1}: ${header.checked ? value || '(blank header)' : `Column ${i + 1}`}`);
    columns.querySelectorAll('label').forEach(label => label.remove());
    headings.forEach((label, i) => { const wrapper = document.createElement('label'); const check = document.createElement('input'); check.type = 'checkbox'; check.value = String(i); check.checked = true; check.addEventListener('change', invalidateResult); wrapper.append(check, document.createTextNode(` ${label} `)); columns.append(wrapper); });
    options.hidden = false; columns.hidden = mode.value !== 'selected';
    status.textContent = `${rows.length - (header.checked ? 1 : 0)} data rows read. Choose matching columns, then find duplicates.`;
  } catch (e) { message((e as Error).message); }
});
mode.addEventListener('change', () => { columns.hidden = mode.value !== 'selected'; invalidateResult(); });
element('csv-check').addEventListener('click', () => {
  message('');
  try {
    const keys = mode.value === 'selected' ? Array.from(columns.querySelectorAll<HTMLInputElement>('input:checked'), item => Number(item.value)) : undefined;
    const offset = header.checked ? 1 : 0, data = rows.slice(offset);
    if (!data.length) throw new Error('Add at least one data row to check.');
    const found = findDuplicates(data, keys);
    cleaned = header.checked ? [rows[0], ...found.kept] : found.kept;
    const headings = rows[0].map((value, i) => header.checked ? `${i + 1}: ${value || '(blank header)'}` : `Column ${i + 1}`);
    element('csv-counts').textContent = `Before: ${found.before} data rows. Removed: ${found.removed} duplicate rows. After: ${found.after} data rows.${header.checked ? ' Header excluded from these counts.' : ''}`;
    const conflicts = conflictingDuplicates(data, found.duplicates);
    conflictCount = conflicts.length;
    if (conflictCount) {
      conflictWarning.textContent = `Warning: ${conflictCount} row(s) share your selected matching keys but contain different values in other columns. Downloading will remove these rows and may discard meaningful updates. Compare the original records below before proceeding.`;
      conflictWarning.hidden = false; conflictTable.hidden = false; conflictAckRow.hidden = false;
      preview('csv-conflict-table', conflicts.map(item => [
        String(item.firstIndex + offset + 1),
        String(item.index + offset + 1),
        item.differingColumns.map(column => headings[column]).join(', '),
      ]), ['Kept record', 'Removed record', 'Different columns']);
    } else resetConflicts();
    preview('csv-before', data, headings);
    preview('csv-duplicates', found.duplicates.map(item => [String(item.index + offset + 1), String(item.firstIndex + offset + 1), ...item.row]), ['Removed record', 'Kept record', ...headings]);
    preview('csv-after', found.kept, headings);
    const risk = cleaned.reduce((sum, row) => sum + row.filter(hasFormulaRisk).length, 0);
    element('csv-risk').textContent = `${risk} exported cell(s) have a possible formula prefix, including headers. Detection is a warning, not a security guarantee.`;
    ack.checked = false; download.disabled = true; results.hidden = false;
    status.textContent = `Check complete: ${found.removed} duplicates found. Review the previews.`;
  } catch (e) { invalidateResult(); message((e as Error).message); }
});
const refreshDownload = () => {
  download.disabled = !ack.checked || !cleaned.length || (conflictCount > 0 && !conflictAck.checked);
};
ack.addEventListener('change', refreshDownload);
conflictAck.addEventListener('change', refreshDownload);
download.addEventListener('click', () => {
  if (!ack.checked || !cleaned.length || (conflictCount > 0 && !conflictAck.checked)) return;
  const url = URL.createObjectURL(new Blob([stringifyCSV(cleaned)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'cleaned.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Cleaned CSV download started. Original cell values were preserved.';
});
element('csv-sample').addEventListener('click', () => { invalidate(); file.value = ''; header.checked = true; input.value = 'id,name,region\n001,Ada,East\n001,Ada,East\n002,"Lin, Jo",West\n001,Ada,North'; status.textContent = 'Sample added. Choose Read CSV.'; });
element('csv-reset').addEventListener('click', () => { invalidate(); input.value = ''; file.value = ''; header.checked = true; mode.value = 'all'; status.textContent = 'CSV cleared.'; });
