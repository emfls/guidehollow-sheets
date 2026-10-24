---
title: "SUMIFS with Dates: A Step-by-Step Excel and Google Sheets Tutorial"
description: "Sum monthly amounts using an inclusive start and exclusive next-month boundary, with timestamp edge cases and expected Excel/Sheets totals."
slug: "sumifs-with-dates"
category: "formulas"
tags: ["SUMIFS", "dates", "Excel", "Google Sheets"]
publishedDate: "2026-10-24"
updatedDate: "2026-10-24"
sources: [{"title": "Microsoft: SUMIFS function", "url": "https://support.microsoft.com/en-au/excel/functions/sumifs-function"}, {"title": "Google: SUMIFS function", "url": "https://support.google.com/docs/answer/3238496?hl=en-GB"}, {"title": "Google: DATEVALUE", "url": "https://support.google.com/docs/answer/3093039?hl=en"}, {"title": "Google: DATE function", "url": "https://support.google.com/docs/answer/3092969?hl=en"}, {"title": "Microsoft: TIME function", "url": "https://support.microsoft.com/en-us/excel/functions/time-function"}]
verification: "Official documentation reviewed 2026-10-24; sample input/output oracles checked with JavaScript assertions. Native Excel and Google Sheets execution not performed."
notionPageId: "402db4c0-a991-812c-b033-d8d01228f080"
draft: false
featured: true
author: "GuideHollow Sheets Editorial"
---
For a monthly SUMIFS that includes timestamps, use **greater than or equal to the first day** and **less than the first day of the next month**. This includes every time on the final day without guessing a last possible second. Use real date/time values in the criteria column, not unvalidated date strings.

> **Key takeaways**
> - October's interval is `>=DATE(2026,10,1)` and `<DATE(2026,11,1)`.
> - `<=DATE(2026,10,31)` excludes times after midnight on October 31.
> - A zero total can signal text dates or a wrong criterion, not an empty month.

## Prepare six boundary cases

Download [the date boundary input](/examples/content-sumifs.csv). It stores timestamps as source text for portability. Do not assume your import converted them to native date/time values. For a reliable exercise, create these values in A2:A7 with DATE and TIME, put the amounts in B2:B7, and channels in C2:C7.

| Cell | Native date/time construction | Amount | Channel |
| --- | --- | --- | --- |
| A2 | `=DATE(2026,9,30)+TIME(23,59,59)` | 100 | Web |
| A3 | `=DATE(2026,10,1)` | 10 | Web |
| A4 | `=DATE(2026,10,15)+TIME(12,0,0)` | 25 | Store |
| A5 | `=DATE(2026,10,31)` | 20 | Web |
| A6 | `=DATE(2026,10,31)+TIME(23,59,59)` | 30 | Web |
| A7 | `=DATE(2026,11,1)` | 200 | Web |

### Copy the six practice rows instead of typing them

If you prefer a faster setup, copy the **seven lines** below (one header and six transactions) into cell **A1** of a **new blank sheet**. Each line has three fields separated by **real tab characters**. The expressions in column A use `DATE` and `TIME`, so they create numeric spreadsheet dates instead of relying on automatic interpretation of timestamp text in the downloaded CSV.

1. Start with an empty sheet using its normal **Automatic** (Google Sheets) or **General** (Excel) cell format, **not Plain text**. Paste into **A1**, not into the cell's edit mode. Check that the three headers occupy A1:C1 and the six transactions occupy A2:C7.
2. If your spreadsheet does not split the pasted text into three columns, undo and use a proper tab-delimited paste/import method. Do not silently continue with a one-column dataset.
3. Format **A2:A7** as date and time so the seconds are visible. In an empty cell, run `=ISNUMBER(A2)` through `=ISNUMBER(A7)`; all six must return **TRUE**. Check that A6 shows **October 31, 2026 at 23:59:59** (or equivalent local display). The intended sample times are fictional local timestamps, with **no timezone conversion**.
4. If the cells literally display `=DATE(...)` or return errors, check whether the target cells were formatted as text or your locale uses different formula separators. Correct that in a disposable practice sheet before applying the SUMIFS formulas below. The downloadable CSV remains the unchanged raw-text reference.

```text
Date/time	Amount	Channel
=DATE(2026,9,30)+TIME(23,59,59)	100	Web
=DATE(2026,10,1)	10	Web
=DATE(2026,10,15)+TIME(12,0,0)	25	Store
=DATE(2026,10,31)	20	Web
=DATE(2026,10,31)+TIME(23,59,59)	30	Web
=DATE(2026,11,1)	200	Web
```

This small tab-delimited practice block is **not** a universal CSV import method: it does not preserve arbitrary quoted commas, tabs inside fields, formulas from untrusted files, or timezone offsets. It is a reviewed, fictional alternative for these exact six rows. Microsoft documents [TIME](https://support.microsoft.com/en-us/excel/functions/time-function) as a fraction of a day, and Google documents [DATE](https://support.google.com/docs/answer/3092969?hl=en) as a date value. The original CSV and the formulas here have been compared as data, **not executed in a live Excel or Google Sheets workbook**.

Format A2:A7 as date/time so the time portion is visible. Check `=ISNUMBER(A2)` and fill it down; all six results should be TRUE. A date-looking display does not replace this check. If your real input is text, preserve it and follow the [CSV/date import guide](/data-cleaning/import-csv-preserve-zeros-dates/) before summing it.

## Write the monthly total

Enter this formula outside the data range:

```excel
=SUMIFS(B2:B7,A2:A7,">="&DATE(2026,10,1),A2:A7,"<"&DATE(2026,11,1))
```

Expected result: **85**. It includes the four October amounts 10, 25, 20, and 30. September's 100 and November's 200 are excluded. The ampersand joins each comparison operator to a computed date value, avoiding an ambiguous criterion such as `"10/1/2026"`.

Both [Microsoft's SUMIFS reference](https://support.microsoft.com/en-au/excel/functions/sumifs-function) and [Google's SUMIFS reference](https://support.google.com/docs/answer/3238496?hl=en-GB) put the sum range first, followed by range/criterion pairs. Each pair further restricts which rows contribute. Keep B2:B7 and every criteria range aligned.

## Add a channel and a reusable month selector

To total October Web sales:

```excel
=SUMIFS(B2:B7,A2:A7,">="&DATE(2026,10,1),A2:A7,"<"&DATE(2026,11,1),C2:C7,"Web")
```

Expected result: **60**, from 10 + 20 + 30. The Store transaction is excluded.

For a reusable report, put `=DATE(2026,10,1)` in E2, then use:

```excel
=SUMIFS($B$2:$B$7,$A$2:$A$7,">="&E2,$A$2:$A$7,"<"&DATE(YEAR(E2),MONTH(E2)+1,1))
```

This version assumes E2 is the first day of the target month. A mid-month E2 would exclude earlier transactions. For a selector that may contain any day within a month, explicitly construct both boundaries:

```excel
=SUMIFS($B$2:$B$7,$A$2:$A$7,">="&DATE(YEAR(E2),MONTH(E2),1),$A$2:$A$7,"<"&DATE(YEAR(E2),MONTH(E2)+1,1))
```

The next-month expression also handles December rolling into January. Keep the criterion month in a real date cell rather than text such as October.

## Demonstrate the final-day bug

Run this deliberately incomplete version on the same sample:

```excel
=SUMIFS(B2:B7,A2:A7,">="&DATE(2026,10,1),A2:A7,"<="&DATE(2026,10,31))
```

Expected result: **55**. It includes midnight at the start of October 31 but misses the 30 at 23:59:59. That is why an exclusive next-month boundary is safer than an inclusive final-date boundary when times exist.

For a single day, use the same interval pattern. The October 31 total should be **50**:

```excel
=SUMIFS(B2:B7,A2:A7,">="&DATE(2026,10,31),A2:A7,"<"&DATE(2026,11,1))
```

## Diagnose a wrong total

| Result | Inspect | Remedy |
| --- | --- | --- |
| Zero despite visible October dates | `ISNUMBER` on date/time and amount cells | Resolve text import against a known source format. |
| Missing last-day transactions | Upper bound set to October 31 midnight | Replace it with `<` November 1. |
| Unexpected rows included | Month criterion lacks a year | Use explicit date boundaries for the intended year. |
| Range error or inconsistent report | Sum/criteria endpoints differ | Align all ranges and extend them together. |

[Google notes](https://support.google.com/docs/answer/3093039?hl=en) that DATEVALUE's understood string formats depend on regional settings. Do not use it to guess whether `03/04/2026` means March 4 or April 3. Set the source's date convention before conversion. For UTC or offset-bearing exports, also agree on the reporting timezone before creating local date/time values; these examples contain no timezone conversion.

## Verification limits

JavaScript UTC interval checks confirm totals **85**, **60**, **55**, and **50**, including exact boundary exclusion. They test the mathematical example, not native date serial conversion or SUMIFS calculation. Excel and Sheets formulas remain unexecuted in those engines. Formulas use English names and commas; adjust separators for your locale and recalculate the fixture in the target application.

If you need the underlying rows instead of a total, see [Google Sheets FILTER examples](/formulas/google-sheets-filter-examples/). For moving this report between products, use the [formula compatibility checklist](/comparisons/excel-vs-google-sheets-formulas/) and rerun these boundary cases rather than checking only the grand total.
