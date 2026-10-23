GuideHollow Sheets original synthetic fixtures — 2026-10-24

These small comma-free CSV fixtures accompany the six guides. Keep header row 1 and data starting at row 2. Preserve identifiers as text. CSV files carry no column type schema.

content-xlookup.csv: SKU text, Price numeric. First 00124 -> 24; last -> 26; missing 00999 -> Not found.
content-filter.csv: Order/Region/Status text, Units numeric. East -> O-101/O-103. Open and Units>=8 -> O-102/O-104. East or North -> O-101/O-103/O-104. South -> no rows.
content-import.csv: all columns initially text. 00123 length 5; long ID length 18; 001E5 literal. 03/04/2026 and 04/03/2026 deliberately unresolved.
content-duplicates.csv: raw strings; all columns exact keep first -> source rows 2,4,5,6,7; order_id-only -> 2,4,6. Case-sensitive raw equality differs from application cleanup behavior.
content-sumifs.csv: timestamp_text is source text, without timezone. Construct native DATE/TIME inputs from guide before SUMIFS. October total 85; Web October 60; October31 total 50; flawed <=October31 midnight total 55.
content-compatibility.csv: Item/Region text, Units numeric. East and Units>=5 -> Clip/East/9; South -> no rows; Units*2 -> 6,14,18,10; Clip lookup -> 9.

Verification: Node.js assertions check mathematical and raw-text expectations. No native Excel or Google Sheets execution and no workbook export/import round trip were performed. Do not infer that raw CSV equality matches native spreadsheet deduplication.
