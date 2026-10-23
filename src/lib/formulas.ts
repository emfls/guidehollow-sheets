export type Product = 'Excel' | 'Google Sheets';
export interface Formula {
  name: string;
  task: string;
  purpose: string;
  inputs: string;
  output: string;
  limits: string;
  excelSyntax: string;
  sheetsSyntax: string;
  excelExample: string;
  sheetsExample: string;
  excelSource: string;
  sheetsSource: string;
}
const microsoft = 'https://support.microsoft.com/en-us/excel/functions/';
const google = 'https://support.google.com/docs/answer/';
export const formulas: Formula[] = [
  {
    name: 'SUMIFS', task: 'Sum and count', purpose: 'Add amounts that meet every condition.',
    excelSyntax: 'SUMIFS(sum_range, criteria_range1, criteria1, [criteria_range2, criteria2], …)',
    sheetsSyntax: 'SUMIFS(sum_range, criteria_range1, criterion1, [criteria_range2, criterion2, …])',
    excelExample: '=SUMIFS(C2:C4,A2:A4,"East",B2:B4,"Paid")', sheetsExample: '=SUMIFS(C2:C4,A2:A4,"East",B2:B4,"Paid")',
    inputs: 'A2:C4 rows: East | Paid | 20; West | Paid | 30; East | Paid | 15. Amounts in C are numbers.', output: '35',
    limits: 'Conditions use AND. Keep every range the same size. Put sum_range first; SUMIF uses a different argument order. Text and operator criteria need quotes.',
    excelSource: microsoft + 'sumifs-function', sheetsSource: google + '3238496',
  },
  {
    name: 'COUNTIFS', task: 'Sum and count', purpose: 'Count rows that satisfy multiple conditions.',
    excelSyntax: 'COUNTIFS(criteria_range1, criteria1, [criteria_range2, criteria2], …)',
    sheetsSyntax: 'COUNTIFS(criteria_range1, criterion1, [criteria_range2, criterion2, …])',
    excelExample: '=COUNTIFS(A2:A4,"East",B2:B4,">=10")', sheetsExample: '=COUNTIFS(A2:A4,"East",B2:B4,">=10")',
    inputs: 'A2:B4 rows: East | 20; West | 30; East | 5. Column B contains numbers.', output: '1',
    limits: 'Each row must meet every condition. Use ranges of equal dimensions. Wildcards in text criteria can match more than literal text; use ~ to escape * or ?.',
    excelSource: microsoft + 'countifs-function', sheetsSource: google + '3256550',
  },
  {
    name: 'XLOOKUP', task: 'Look up data', purpose: 'Return the value beside a matching identifier.',
    excelSyntax: 'XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])',
    sheetsSyntax: 'XLOOKUP(search_key, lookup_range, result_range, [missing_value], [match_mode], [search_mode])',
    excelExample: '=XLOOKUP("P02",A2:A4,B2:B4,"Not found",0)', sheetsExample: '=XLOOKUP("P02",A2:A4,B2:B4,"Not found",0)',
    inputs: 'A2:B4 rows: P01 | Pen; P02 | Notebook; P03 | Clip.', output: 'Notebook',
    limits: 'This example explicitly uses exact matching (0) and returns the first match. Excel 2016/2019 do not support XLOOKUP; use Microsoft 365, Excel 2021 or newer. Binary search modes require correctly sorted data. Text and numeric keys can differ.',
    excelSource: microsoft + 'xlookup-function', sheetsSource: google + '12405947',
  },
  {
    name: 'FILTER', task: 'Filter and deduplicate', purpose: 'Return rows meeting a condition.',
    excelSyntax: 'FILTER(array, include, [if_empty])', sheetsSyntax: 'FILTER(range, condition1, [condition2, …])',
    excelExample: '=FILTER(A2:B4,B2:B4>=10,"No matches")', sheetsExample: '=FILTER(A2:B4,B2:B4>=10)',
    inputs: 'A2:B4 rows: Pen | 8; Book | 15; Clip | 12.', output: 'Two rows: Book | 15; Clip | 12.',
    limits: 'Excel requires a dynamic-array version such as Microsoft 365 or Excel 2021+. Its third argument is an empty-result fallback. In Sheets, additional arguments are conditions, not a fallback; no match returns #N/A. Conditions must align with the range. Leave output cells clear for the returned array.',
    excelSource: microsoft + 'filter-function', sheetsSource: google + '3093197',
  },
  {
    name: 'IFERROR', task: 'Handle errors', purpose: 'Show a helpful fallback when a calculation returns an error.',
    excelSyntax: 'IFERROR(value, value_if_error)', sheetsSyntax: 'IFERROR(value, [value_if_error])',
    excelExample: '=IFERROR(A2/B2,"Check divisor")', sheetsExample: '=IFERROR(A2/B2,"Check divisor")',
    inputs: 'A2 = 10; B2 = 0.', output: 'Check divisor',
    limits: 'Catches many error types and may hide a broken reference or bad input. Diagnose the underlying formula first. Sheets permits an omitted fallback (blank); Excel requires the second argument.',
    excelSource: microsoft + 'iferror-function', sheetsSource: google + '3093304',
  },
  {
    name: 'TRIM', task: 'Clean text', purpose: 'Remove extra ordinary spaces from text.',
    excelSyntax: 'TRIM(text)', sheetsSyntax: 'TRIM(text)',
    excelExample: '=TRIM(A2)', sheetsExample: '=TRIM(A2)',
    inputs: 'A2 contains "  Ada   Lovelace  " (ordinary ASCII spaces).', output: 'Ada Lovelace',
    limits: 'Also reduces repeated ordinary spaces between words to one. Nonbreaking spaces and other Unicode whitespace need separate cleaning. Do not apply to identifiers where spaces matter.',
    excelSource: microsoft + 'trim-function', sheetsSource: google + '3094140',
  },
  {
    name: 'UNIQUE', task: 'Filter and deduplicate', purpose: 'Make a distinct list from repeated values.',
    excelSyntax: 'UNIQUE(array, [by_col], [exactly_once])', sheetsSyntax: 'UNIQUE(range, [by_column], [exactly_once])',
    excelExample: '=UNIQUE(A2:A5)', sheetsExample: '=UNIQUE(A2:A5)',
    inputs: 'A2:A5 contains, in order: Pen; Book; Pen; Clip.', output: 'Three rows: Pen; Book; Clip.',
    limits: 'Returns an array, so leave output cells clear. Excel requires Microsoft 365 or Excel 2021+. The default returns distinct values, not only values appearing once; exactly_once changes that behavior. Hidden spaces can create apparently repeated text.',
    excelSource: microsoft + 'unique-function', sheetsSource: google + '10522653',
  },
  {
    name: 'LEFT', task: 'Clean text', purpose: 'Extract a fixed-length prefix from a text value.',
    excelSyntax: 'LEFT(text, [num_chars])', sheetsSyntax: 'LEFT(string, [number_of_characters])',
    excelExample: '=LEFT(A2,3)', sheetsExample: '=LEFT(A2,3)',
    inputs: 'A2 contains text "INV-2048".', output: 'INV',
    limits: 'The character count must be nonnegative. This is a fixed-position extraction, not a delimiter parser. Format identifier inputs as text to keep leading zeros. Unicode character counting can depend on the spreadsheet product and workbook compatibility.',
    excelSource: microsoft + 'left-function', sheetsSource: google + '3094079',
  },
];

export function filterFormulas(query: string, task = 'all'): Formula[] {
  const term = query.trim().toLowerCase();
  return formulas.filter(item => (task === 'all' || item.task === task) && `${item.name} ${item.purpose} ${item.task}`.toLowerCase().includes(term));
}
