# Limitations and recovery

## Excel

ExcelJS writes styles, column widths, frozen headers, hyperlinks, dates, and formula objects with a cached result. It does not evaluate formulas, and it does not copy every original conditional format or every original column width. KPI weight formulas are rewritten with the cached number from the scoped-weight rule.

Derived sheets are rebuilt from the ticket master and from the recorded Yes/No. They are not a byte-for-byte copy of the original file. Ticket descriptions, numbers, dates, blank line counts, and checklist text are the fidelity target.

A workbook-only link such as `Q3-2025_Ticket_Summary!A1` opens inside Excel. In the app it is shown as a sheet reference.

## Scoring

Krishna 0.3 uses the scoped quarter weight, so the scorecard and the checklist total the same way. The unchanged v0.2 workbook still shows a quarter as 100 and a checklist grand total of 240. Import whichever file matches the score rule you want. See the workbook analysis.

Santosh SLA rows can stay Yes while the 45-day rule calculates Not achieved. The recorded status remains until a manager saves an override with a reason.

A quarter with no tickets is insufficient evidence or not applicable. It is not a zero and it is not a failed appraisal.

## Storage

IndexedDB is the working copy. The seed JSON is only the first-run import. Export a JSON backup before clearing the browser, because the data is not encrypted and there is no server copy.

If a save reports a quota error, download the JSON backup first. Then remove unneeded undo history by continuing work in a fresh browser profile only after the backup is stored.

If a JSON restore fails validation, the current IndexedDB copy is left as it was. The message names the field. A newer `schemaVersion` is rejected instead of being guessed.

An Excel import shows a preview and the detected sheet names. Cancel does not write. Commit merges by stable ids. A CSV ticket paste is saved only when every row is valid; clearing the paste leaves existing tickets unchanged.

A connected JSON file is written only after the write stream closes. If the file's revision is newer, the app asks before replacing it. A failed write is reported as not updated.

## Recovery

1. Download JSON from Import or Settings.
2. If the screen fails to load, export is still available from a working browser profile that has the data.
3. Use Undo on Settings for the last saved edit. Undo does not cross a JSON restore that you already confirmed.
4. Reopen a finalized quarter only with a reason. The reason is stored on the audit entry.

## Access

There is no login. Anyone who can open this browser profile can read the appraisals. That is not a substitute for company access control.
