---
title: "How to Import CSV Files Without Losing Leading Zeros or Changing Dates"
description: "Preserve CSV identifiers and date text during import, then validate raw values before converting any dates in Excel or Google Sheets."
slug: "import-csv-preserve-zeros-dates"
category: "data-cleaning"
tags: ["CSV", "leading zeros", "dates", "import"]
publishedDate: "2026-10-24"
updatedDate: "2026-10-24"
sources: [{"title": "Microsoft: Keeping leading zeros and large numbers", "url": "https://support.microsoft.com/en-us/excel/keeping-leading-zeros-and-large-numbers"}, {"title": "Microsoft: Import or export text files", "url": "https://support.microsoft.com/en-us/excel/get-started/import-or-export-text-txt-or-csv-files"}, {"title": "Google: DATEVALUE", "url": "https://support.google.com/docs/answer/3093039?hl=en"}]
verification: "Official documentation reviewed 2026-10-24; sample input/output oracles checked with JavaScript assertions. Native Excel and Google Sheets execution not performed."
notionPageId: "402db4c0-a991-810e-84ed-cff21c72036a"
draft: false
featured: true
author: "GuideHollow Sheets Editorial"
---
Import identifiers and uncertain dates as text first. In Excel, use Data → From Text/CSV and inspect the transformation steps before loading; in Google Sheets, review the file import conversion option and keep automatic conversion off for the preservation pass. Do not double-click a CSV and assume that visually plausible cells still contain the original strings.

> **Key takeaways**
> - Quoting `"00123"` in a CSV does not declare a text column type.
> - Preserve `03/04/2026` until the source owner confirms its date order.
> - Compare lengths and actual values after import, before saving over the source.

## Use a file that exposes silent changes

Download [the CSV preservation input](/examples/content-import.csv). These are synthetic records, not real account details. The intended initial import keeps all three columns as text.

| account_id | event_date_raw | amount_raw |
| --- | --- | --- |
| 00123 | 03/04/2026 | 19.50 |
| 00007 | 2026-10-24 | 8.00 |
| 123456789012345678 | 2026-10-25 | 12.75 |
| 001E5 | 04/03/2026 | 6.25 |

The first and fourth dates are deliberately ambiguous. One can mean March 4 or April 3 depending on convention. Neither interpretation is established by this file. The 18-digit identifier tests precision preservation, while `001E5` tests whether a code is treated as scientific notation.

Open the downloaded file in a plain-text editor before import and leave that original unchanged. A CSV describes delimiters, quotes, and text fields; it does not carry the column types that a workbook does.

## Excel: set text before loading

For desktop Excel versions with the Text/CSV Power Query connector:

1. Create a blank workbook and choose **Data → From Text/CSV**.
2. Select the file, check the delimiter in the preview, and choose **Transform Data**.
3. Inspect Applied Steps. If an automatically added **Changed Type** step already interpreted the identifiers or dates, remove that step before setting types. Converting a damaged number back to text cannot recover lost digits.
4. Set `account_id` and `event_date_raw` to **Text**. For this preservation exercise set `amount_raw` to Text too; a separate numeric conversion can follow later.
5. Close and load into a new worksheet. Compare all four identifiers to the original file.

Microsoft documents [text types during import](https://support.microsoft.com/en-us/excel/keeping-leading-zeros-and-large-numbers) and the [Text/CSV import route](https://support.microsoft.com/en-us/excel/get-started/import-or-export-text-txt-or-csv-files). Menu wording and connector availability vary by platform and edition. If your build presents the Text Import Wizard instead, choose the delimiter and mark the identifier/date columns **Text** before finishing. Keep a separate copy when trying an unfamiliar import path.

A five-digit custom number format can make 123 look like 00123. It does not establish that the stored ID is the text `00123`, and it cannot reconstruct an unknown number of removed zeros or precision lost from a long ID.

## Google Sheets: keep the initial import literal

In a blank Sheets file, choose **File → Import → Upload**, select the CSV, and choose a new sheet as the destination. In import dialogs that offer **Convert text to numbers, dates, and formulas**, clear that option for this exercise. Check the displayed option in your current dialog; this article's exact UI sequence has not been tested in a live Sheets session.

If that control is absent, do not assume conversion is disabled. For this small comma-free dataset, a reversible fallback is to preformat A:C as **Plain text**, paste tab-separated text from a plain-text editor, and verify the cells. For general CSV containing quoted commas or embedded line breaks, do not split it by hand; retain the source and use an import path that supports its CSV structure.

Run the checks below regardless of the import route. If they fail, discard the practice sheet and return to the untouched file rather than fixing only what is visible.

## Validate before converting dates

With headers in row 1, these checks should return TRUE:

```excel
=AND(ISTEXT(A2),EXACT(A2,"00123"),LEN(A2)=5)
=AND(ISTEXT(A4),EXACT(A4,"123456789012345678"),LEN(A4)=18)
=AND(ISTEXT(A5),EXACT(A5,"001E5"))
=EXACT(B2,"03/04/2026")
```

After the source confirms a year-month-day contract, the unambiguous text in B3 can be converted in a helper cell:

```excel
=DATE(VALUE(LEFT(B3,4)),VALUE(MID(B3,6,2)),VALUE(RIGHT(B3,2)))
```

Expected date: **October 24, 2026**. This formula is for an already validated `YYYY-MM-DD` value; DATE can normalize invalid components, so it is not an input validator. Leave B2 and B5 as raw text until their convention is known. [Google's DATEVALUE reference](https://support.google.com/docs/answer/3093039?hl=en) warns that accepted string formats depend on region and language settings; a conversion that succeeds can still answer the wrong interpretation.

## Export and handoff limits

Save the working file in its native workbook format to retain types, formulas, and multiple tabs. If exporting to CSV, re-open the exported file as plain text and check the IDs again. A future reader's automatic import settings can still change them. Provide a schema note such as “account_id: text; event_date_raw: unparsed source text” alongside the CSV.

JavaScript assertions verify that the sample file contains the specified strings and lengths; no Excel or Sheets import was executed. The Sheets import controls and workbook conversion steps need a native application check. English formula names and comma separators are used here. Continue with [safe duplicate review](/data-cleaning/remove-duplicate-rows/) or [date totals](/formulas/sumifs-with-dates/) only after type validation. The [CSV duplicate checker](/tools/csv-duplicate-checker/) helps compare raw rows; it does not repair dates or infer an identifier schema.
