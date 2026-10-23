---
title: "Excel vs Google Sheets: Formula Compatibility Differences That Matter"
description: "Compare FILTER signatures, array formulas, lookup version support, and date inputs using a small migration checklist and expected outputs."
slug: "excel-vs-google-sheets-formulas"
category: "comparisons"
tags: ["Excel", "Google Sheets", "formula compatibility"]
publishedDate: "2026-10-24"
updatedDate: "2026-10-24"
sources: [{"title": "Microsoft: FILTER function", "url": "https://support.microsoft.com/en-us/excel/functions/filter-function"}, {"title": "Google: FILTER function", "url": "https://support.google.com/docs/answer/3093197?hl=en"}, {"title": "Microsoft: XLOOKUP function", "url": "https://support.microsoft.com/en-gb/excel/functions/xlookup-function"}, {"title": "Google: XLOOKUP function", "url": "https://support.google.com/docs/answer/12405947?hl=en"}, {"title": "Google: ARRAYFORMULA", "url": "https://support.google.com/docs/answer/3093275?hl=en"}, {"title": "Microsoft: SUMIFS function", "url": "https://support.microsoft.com/en-au/excel/functions/sumifs-function"}, {"title": "Google: SUMIFS function", "url": "https://support.google.com/docs/answer/3238496?hl=en-GB"}]
verification: "Official documentation reviewed 2026-10-24; sample input/output oracles checked with JavaScript assertions. Native Excel and Google Sheets execution not performed."
notionPageId: "402db4c0-a991-8124-8282-c1e3ae57d8ec"
draft: false
featured: false
author: "GuideHollow Sheets Editorial"
---
Check formula signatures, product versions, and imported data types before moving a workbook between Excel and Google Sheets. A shared function name does not guarantee a drop-in replacement. Start with a small input/output fixture, test an empty result and a boundary case, then compare the actual saved file in the receiving application.

> **Key takeaways**
> - FILTER is a concrete syntax difference: Excel has an empty-result argument; Sheets accepts additional conditions.
> - XLOOKUP exists in Sheets and modern Excel, but Excel 2016/2019 cannot calculate it.
> - A successful file opening is not evidence that the formulas recalculated correctly.

## Differences to check first

| Requirement | Excel | Google Sheets | Migration action |
| --- | --- | --- | --- |
| Return matching rows | `FILTER(array,include,[if_empty])` | `FILTER(range,condition1,[condition2,...])` | Rewrite the conditions and no-match handling. |
| Exact lookup | XLOOKUP in supported editions | XLOOKUP available | Check version, ranges, and duplicate rule. |
| Array calculations | Dynamic arrays in supported editions | Many arrays expand automatically; ARRAYFORMULA supports additional array use | Inspect the expression and output area; do not mechanically add/remove wrappers. |
| Conditional total | SUMIFS with sum range first | SUMIFS with sum range first | Check actual dates, types, and equal range sizes. |

The signatures come from the official [Excel FILTER](https://support.microsoft.com/en-us/excel/functions/filter-function), [Sheets FILTER](https://support.google.com/docs/answer/3093197?hl=en), [Excel XLOOKUP](https://support.microsoft.com/en-gb/excel/functions/xlookup-function), and [Sheets XLOOKUP](https://support.google.com/docs/answer/12405947?hl=en) references. This is a focused comparison, not a complete compatibility inventory or speed benchmark.

## Recheck one filter in both products

Download [the compatibility input](/examples/content-compatibility.csv) and place it in A1:C5. Numbers in Units should be numeric.

| A: Item | B: Region | C: Units |
| --- | --- | --- |
| Pen | East | 3 |
| Book | West | 7 |
| Clip | East | 9 |
| Pad | North | 5 |

Task: return East rows with at least five units. Expected output is **Clip, East, 9** only.

In modern Excel:

```excel
=FILTER(A2:C5,(B2:B5="East")*(C2:C5>=5),"No rows")
```

In Google Sheets:

```excel
=IFNA(FILTER(A2:C5,B2:B5="East",C2:C5>=5),"No rows")
```

Then change East to South. Both intended user-facing outputs are the single-cell message **No rows**. The underlying empty-result behavior differs: without a fallback, Excel FILTER reports `#CALC!`, while Sheets FILTER reports `#N/A`. IFNA can hide other `#N/A` failures too, so first validate a known matching case and aligned conditions.

This pair is a useful migration check because copying only the visible result would miss the signature difference. See the larger [Sheets FILTER exercise](/formulas/google-sheets-filter-examples/) for OR conditions and overlapping matches.

## Treat array behavior as part of the formula

For a two-times Units helper, a small Excel dynamic-array expression is:

```excel
=C2:C5*2
```

The corresponding Sheets example makes its array intent explicit:

```excel
=ARRAYFORMULA(C2:C5*2)
```

Expected vertical output: **6, 14, 18, 10**. [Google's ARRAYFORMULA reference](https://support.google.com/docs/answer/3093275?hl=en) explains that many array formulas expand without an explicit wrapper. Therefore the wrapper is not a universal requirement for every function. FILTER already returns an array. Check each expression rather than surrounding every migrated formula with ARRAYFORMULA.

Leave a clear destination area for these results. A blocked output region is a layout problem; replacing the function name cannot solve it. Older Excel versions may require a different approach such as a copied per-row `=C2*2` formula. Do not promise identical array behavior in Excel 2016/2019.

## Check lookups against the receiver's version

For the compatibility input:

```excel
=XLOOKUP("Clip",A2:A5,C2:C5,"Missing",0)
```

Expected result: **9**. Searching for Tape should return **Missing**. Both product references document an exact-match option, but the receiving Excel edition must support the function. Microsoft explicitly states that XLOOKUP is unavailable in Excel 2016 and Excel 2019. If those recipients are in scope, test a suitable INDEX/MATCH fallback rather than sending a workbook that merely opens.

A duplicated key creates a separate business question even when both engines support the syntax. Use the [XLOOKUP repair dataset](/troubleshooting/xlookup-not-working/) to test first and last matches. Removing duplicates to make an error disappear can erase meaningful revisions; use the [duplicate review procedure](/data-cleaning/remove-duplicate-rows/) first.

## Shared syntax still needs shared input meaning

SUMIFS has a similar sum-range-first structure in [Excel](https://support.microsoft.com/en-au/excel/functions/sumifs-function) and [Sheets](https://support.google.com/docs/answer/3238496?hl=en-GB). That does not make a date-looking text column a date column. Two files can display October 1 while one stores text and the other a numeric date/time value.

Use constructed DATE/TIME inputs and the [monthly boundary fixture](/formulas/sumifs-with-dates/) to compare an October total of 85, a Web-only total of 60, and the exclusion of November 1. Check source IDs with the [CSV preservation exercise](/data-cleaning/import-csv-preserve-zeros-dates/) too: a correct formula cannot restore digits lost during import.

## A practical migration acceptance check

1. Keep the original native file and make a receiving-application copy.
2. Record the receiving product, edition, platform, locale, and date conventions.
3. Run the Clip filter and South no-match checks above.
4. Run the array output and lookup missing-key checks.
5. Run the timestamp boundary example, then save, close, reopen, and recalculate in the receiving application.
6. Compare key outputs and formulas, including any conversion warnings. Document exceptions before sharing the converted workbook.

English function names and comma separators are used here. Locale-specific separators, named ranges, external connections, scripts, table references, and round-trip file conversion need workbook-specific review. This article does not certify those features or claim that every formula listed will survive every export format.

JavaScript assertions verify the expected fixture rows, doubled values, and lookup outputs. Neither Excel nor Sheets nor an XLSX round trip was executed for this comparison. The [formula finder](/tools/formula-finder/) can suggest a pattern, but the acceptance checks in the receiving application determine whether a handoff is ready.
