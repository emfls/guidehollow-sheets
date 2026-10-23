# Learning report: How to Import CSV Files Without Losing Leading Zeros or Changing Dates

## search intent
Preserve CSV identifiers and date text during import, then validate raw values before converting any dates in Excel or Google Sheets.

## sources/date/claims
Retrieved and read 2026-10-24 through web search and direct page opens. Function/version and UI claims are attributed to primary support pages; examples and expected outputs are original synthetic fixtures.

- [Microsoft: Keeping leading zeros and large numbers](https://support.microsoft.com/en-us/excel/keeping-leading-zeros-and-large-numbers)
- [Microsoft: Import or export text files](https://support.microsoft.com/en-us/excel/get-started/import-or-export-text-txt-or-csv-files)
- [Google: DATEVALUE](https://support.google.com/docs/answer/3093039?hl=en)

## distinct contribution
A four-row preservation fixture contains leading zeros, a long ID, an exponent-like ID, and deliberately unresolved ambiguous dates.

## prior lessons applied
- No fake app test: JavaScript oracle checks are not reported as Excel or Google Sheets execution.
- Original recheckable inputs/results: a downloadable fixture, explicit cell layout, formulas, and expected outcomes let a reader reproduce the exercise.

## corrections
Separates display padding from stored text, removes automatic type conversion before text typing, and never guesses ambiguous date order.

## unverified
Native Excel and Google Sheets execution, platform/locale UI behavior, rendered page appearance, and postpublication behavior remain unverified by the content author. Formula results are specified from mathematical/raw-text oracles rather than an application calculation log. No performance, indexing, traffic, revenue, or expertise claims are made.

## postpublication URL currently pending
Pending publication: /data-cleaning/import-csv-preserve-zeros-dates/. A route or local build does not verify a live URL.

## next improvements
Recalculate the provided fixture in supported Excel and current Google Sheets; record edition, platform, locale, date/time settings, exact formula, observed output, and retrieval date. For any discrepancy, correct the guide and oracle separately, then review the published page and download.
