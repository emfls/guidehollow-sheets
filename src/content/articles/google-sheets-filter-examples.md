---
title: "Google Sheets FILTER Function: Practical Examples and Common Errors"
description: "Copy Google Sheets FILTER examples for one condition, AND, OR, and no matches, using a five-row dataset with expected outputs."
slug: "google-sheets-filter-examples"
category: "formulas"
tags: ["Google Sheets", "FILTER", "arrays"]
publishedDate: "2026-10-24"
updatedDate: "2026-10-24"
sources: [{"title": "Google: FILTER function", "url": "https://support.google.com/docs/answer/3093197?hl=en"}, {"title": "Microsoft: FILTER function", "url": "https://support.microsoft.com/en-us/excel/functions/filter-function"}]
verification: "Official documentation reviewed 2026-10-24; sample input/output oracles checked with JavaScript assertions. Native Excel and Google Sheets execution not performed."
notionPageId: "402db4c0-a991-8121-bc96-d15c0118a6bc"
draft: false
featured: false
author: "GuideHollow Sheets Editorial"
---
Use `FILTER(range, condition1, condition2, ...)` in Google Sheets to return matching rows. Supply separate conditions for AND; combine Boolean tests into one condition for OR. Keep every condition aligned with the source rows, and handle a genuinely empty result with IFNA after the basic filter works.

> **Key takeaways**
> - Sheets FILTER returns `#N/A` when nothing matches.
> - Its third argument is another condition, not Excel's empty-result message.
> - The result needs an empty destination area as well as valid conditions.

## Build the practice sheet

Download [the FILTER input](/examples/content-filter.csv), place it in A1:D6, and ensure Units contains numbers. Put the formulas in F2 on separate practice tabs or clear the previous output before each example.

| A: Order | B: Region | C: Status | D: Units |
| --- | --- | --- | --- |
| O-101 | East | Open | 4 |
| O-102 | West | Open | 8 |
| O-103 | East | Closed | 12 |
| O-104 | North | Open | 10 |
| O-105 | West | Closed | 3 |

The header is outside each formula's range. This prevents labels from becoming candidate data rows. Keep the same start and end row in the data and all conditions, as required by [Google's FILTER reference](https://support.google.com/docs/answer/3093197?hl=en).

## Return one region

```excel
=FILTER(A2:D6,B2:B6="East")
```

Expected order IDs: **O-101, O-103**, in source order. The result contains all four columns of each matching row. To return only the order IDs instead, use:

```excel
=FILTER(A2:A6,B2:B6="East")
```

A condition may refer to a column that is outside the returned range; it must still describe the same rows. This is useful when a report needs only customer IDs but filters by status or date stored elsewhere.

## Require both conditions: AND

To return open orders with at least eight units:

```excel
=FILTER(A2:D6,C2:C6="Open",D2:D6>=8)
```

Expected IDs: **O-102, O-104**, with units **8, 10**. O-103 has enough units but is closed, so it is excluded. Checking this rejected row matters: a result containing only plausible rows can still be applying the wrong logical operator.

## Allow either condition: OR

To include East or North:

```excel
=FILTER(A2:D6,((B2:B6="East")+(B2:B6="North"))>0)
```

Expected IDs: **O-101, O-103, O-104**. Each row passes when at least one test is true. The final `>0` expresses that rule as a Boolean condition. For an overlap check, try East OR Open:

```excel
=FILTER(A2:D6,((B2:B6="East")+(C2:C6="Open"))>0)
```

Expect **O-101, O-102, O-103, O-104**. O-101 satisfies both conditions but appears once, because the formula filters source rows rather than concatenating two result lists.

## Handle no matches without hiding a broken formula

First run the unwrapped formula:

```excel
=FILTER(A2:D6,B2:B6="South")
```

There are no South rows; Sheets returns `#N/A`. For a user-facing message after validating the ranges:

```excel
=IFNA(FILTER(A2:D6,B2:B6="South"),"No matching orders")
```

The message is one cell, not a four-column blank record. Do not feed it into a downstream report as though it were an order. IFNA also catches other `#N/A` errors, including a bad condition shape, so add it last. Avoid blanket IFERROR during diagnosis: hiding an error does not prove that the criteria are correct.

## Troubleshoot the output

| Problem | Likely cause | Check |
| --- | --- | --- |
| Mismatched range error | A2:D6 paired with B2:B5 | Count data rows and align the endpoints. |
| `#REF!` expansion error | Occupied cells or merged cells in destination | Put the formula in a clear area on a practice sheet. |
| Unexpectedly missing numeric rows | Units imported as text | Check `=ISNUMBER(D2)` and review the import. |
| A third argument causes trouble | Excel's fallback text copied into Sheets | Move the fallback outside FILTER with IFNA. |

[Excel FILTER](https://support.microsoft.com/en-us/excel/functions/filter-function) has a different signature: `FILTER(array,include,[if_empty])`. See the [Excel/Sheets comparison](/comparisons/excel-vs-google-sheets-formulas/) before transferring a multi-condition formula.

## Limits and verification

These examples use Google Sheets on the web, English function names, and comma separators. Locale may change separators and number/date interpretation. The fixed six-row boundary is intentional for a reproducible exercise; extend the data and every condition together for your own sheet. For monthly date totals rather than returned rows, use [SUMIFS with date boundaries](/formulas/sumifs-with-dates/).

JavaScript checks confirm the listed row IDs, the OR overlap, and the empty match set from the downloaded data. They do not execute Sheets FILTER. Native recalculation, destination expansion, and localized syntax remain unverified here. Use the [formula finder](/tools/formula-finder/) to choose a starting pattern, then perform these input/output checks in your sheet.
