WI-TAVERN / DeerCamp Partnership Outreach Airtable Repair
=======================================================

The uploaded Airtable export had 1,429 rows after an accidental append import.
This package includes two repair options:

1) 01_RESTORE_pre_import_count_714_rows.csv
   - Restores the table to the pre-import row count of 714.
   - This is the safest file if your immediate goal is to reverse the accidental append.

2) 02_CLEAN_real_prospects_712_rows.csv
   - Removes two pre-existing embedded CSV header rows from the 714-row restore.
   - This is the cleaner prospect master.

3) 03_DELETE_rows_from_accidental_import_715_rows.csv
   - Audit/list of rows removed to reverse the accidental append.
   - Includes the Airtable export row number from the 1,429-row file.

4) 05_CLEAN_real_prospects_712_rows_enrichment_ready.csv
   - Clean prospect file plus enrichment/poster/attribution fields for WI-TAVERN rows.

Do NOT import any of these files into the same Airtable table as a normal append.
For a safe rebuild, create a new table from the selected clean CSV, verify counts, then archive/delete the duplicated table.
