---
title: "How to Remove Duplicate Rows in Excel and Google Sheets Safely"
description: "Choose duplicate keys, preview keep-first results, and avoid deleting meaningful revisions in Excel, Google Sheets, and raw CSV files."
slug: "remove-duplicate-rows"
category: "data-cleaning"
tags: ["duplicates", "Excel", "Google Sheets", "CSV"]
publishedDate: "2026-10-24"
updatedDate: "2026-10-24"
sources: [{"title": "Microsoft: Filter for unique values or remove duplicate values", "url": "https://support.microsoft.com/en-us/excel/get-started/filter-for-unique-values-or-remove-duplicate-values"}, {"title": "Google: Split text, remove duplicates, or trim whitespace", "url": "https://support.google.com/docs/answer/6325535?hl=en"}]
verification: "Official documentation reviewed 2026-10-24; sample input/output oracles checked with JavaScript assertions. Native Excel and Google Sheets execution not performed."
notionPageId: "402db4c0-a991-8130-b954-cac9f5629316"
draft: false
featured: false
author: "GuideHollow Sheets Editorial"
---
Copy the source, define which columns identify a duplicate, then preview the survivors before removing rows. Selecting all columns removes repeated records; selecting only an order ID can remove a legitimate revision. Keep the original file until row counts and important totals have been reconciled.

> **Key takeaways**
> - A duplicate rule needs both a comparison key and a survivor rule.
> - Selecting fewer key columns can delete rows whose other values differ.
> - Raw CSV comparison and spreadsheet cleanup can disagree on case, formatting, or imported types.

## Choose the key on a small example

Download [the duplicate review input](/examples/content-duplicates.csv) and preserve the input order. It contains six data rows:

| Source row | order_id | email | amount | status |
| --- | --- | --- | --- | --- |
| 2 | A100 | pat@example.test | 20 | New |
| 3 | A100 | pat@example.test | 20 | New |
| 4 | A101 | sam@example.test | 35 | New |
| 5 | A101 | sam@example.test | 40 | Revised |
| 6 | A102 | Lee@example.test | 12 | New |
| 7 | A102 | lee@example.test | 12 | New |

Two different questions produce different valid outputs:

- **Raw all-column exact comparison, keep first:** remove source row 3 only. Retain rows **2, 4, 5, 6, 7**. Five rows remain and the amount total is **119**.
- **Raw order_id-only comparison, keep first:** remove rows 3, 5, and 7. Retain rows **2, 4, 6**. Three rows remain and the total is **67**.

The original total is **139**. Neither smaller total alone proves correctness: both are consequences of a chosen rule. The A101 revision is the reason to decide the key before opening a Remove Duplicates dialog. The case-only email pair deliberately exposes a limit of raw comparison.

## Preview without deleting

Use the [CSV duplicate checker](/tools/csv-duplicate-checker/) to preview raw records and compare selected keys. For this fixture, select all four columns, use exact text matching, and keep the first occurrence to reproduce the five-row result. Then select only order_id and observe the three-row result. Treat these as explicit raw-text expectations, not an emulator of either spreadsheet application.

In a copy of an Excel or Sheets file, a helper column can preview ID occurrence counts:

```excel
=COUNTIF($A$2:A2,A2)
```

Fill down through row 7. Expected counts for these uppercase IDs are **1, 2, 1, 2, 1, 2**. Values greater than 1 indicate later occurrences of the ID. They do not mean those rows should be deleted: row 5 contains the revised amount. COUNTIF is also unsuitable as a promise of exact case-sensitive raw equality.

To investigate a specific suspected email pair:

```excel
=EXACT(B6,B7)
```

Expected result is **FALSE** because `Lee` differs from `lee`. Decide whether that difference matters to the dataset before normalizing it.

## Excel: remove only after reviewing the key

1. Duplicate the worksheet or save a separate workbook copy.
2. Select the complete A1:D7 data rectangle, including all columns that belong together.
3. Choose **Data → Remove Duplicates** and confirm the header setting.
4. Select the columns that define the key. Selecting order_id alone means an ID collision can remove the entire associated record in the selected range.
5. Review the remaining rows and record the removal count. Reconcile the amount total against the rule you approved.

[Microsoft documents](https://support.microsoft.com/en-us/excel/get-started/filter-for-unique-values-or-remove-duplicate-values) that Excel keeps the first occurrence and that the selected columns form the duplicate key. It also describes comparison in terms of displayed cell content, including formatting differences. Do not assume imported types or different date displays behave like a raw-string CSV comparison. Test a representative copy before using the result as a canonical cleaned dataset.

## Google Sheets: review its comparison rules

In a copy, select A1:D7, then choose **Data → Data cleanup → Remove duplicates**. Confirm whether the selected range has a header and choose the key columns. Keep the range together so deleting a record does not detach amounts from their orders.

[Google's cleanup documentation](https://support.google.com/docs/answer/6325535?hl=en) treats identical values with differences in letter case, formatting, or formulas as duplicates. Therefore do not expect the case-only email pair in this fixture to survive an all-column native cleanup the same way it does under raw exact comparison. This guide does not claim a native Sheets survivor order was executed or verified. If a particular survivor is critical, record source row IDs and validate the retained records, rather than relying on an undocumented assumption here.

## If you need the latest revision

“Keep first” is an ordering rule, not a data-quality rule. To keep the latest A101, you need a reliable revision timestamp or version field; the sample deliberately contains neither. Do not infer chronology from a larger amount or the word Revised. Ask the source for a revision contract, then sort and recheck on a copy under an approved policy.

Whitespace normalization also changes the rule. Preserve original columns and create helpers if trimming is intended. Google notes that its whitespace cleanup does not trim non-breaking spaces. Identifiers with zeros should survive the [CSV import preservation checks](/data-cleaning/import-csv-preserve-zeros-dates/) first.

## Verification and handoff

JavaScript tests verify both raw keep-first scenarios, the survivor source rows, counts, and totals above. They do not execute Excel or Sheets cleanup. Native case/type/format comparison and Sheets survivor order remain unverified. These instructions target desktop Excel and Sheets on the web; labels may differ by edition and locale.

Record the source name, selected columns, normalization decisions, survivor rule, and before/after counts with each cleaned file. If duplicate IDs are breaking a lookup, review [XLOOKUP's first and last matches](/troubleshooting/xlookup-not-working/) before deleting data to make the formula appear correct.
