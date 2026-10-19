# Pradyot's PMS Workbench

Local-first desk for reportee OKRs, quarterly appraisals, ticket evidence, and Excel workbooks that managers already recognise.

The application does not call a backend. Appraisal data stays in this browser unless you export it.

## Versions

| Package | Version |
| --- | --- |
| Next.js | 16.4.2 |
| React | 19.3.1 |
| TypeScript | 5.9.3 |
| MUI | 9.5.0 |
| MUI X Data Grid | 9.15.0 |
| Recharts | 3.10.1 |
| Zod | 4.6.7 |
| React Hook Form | 7.90.0 |
| Dexie | 4.4.6 |
| ExcelJS | 4.4.0 |
| Vitest | 5.0.5 |
| Playwright | 1.64.1 |

ExcelJS is used for import and export because it keeps worksheet order, styles, freeze panes, hyperlinks, and formula objects with cached results. It does not calculate formulas. Scorecard and weight results are calculated in TypeScript and written as cached formula results where the source workbook used a formula.

## Run

```bash
npm install
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run seed` reads the three workbooks in `fixtures/workbooks` and writes `public/seed/initial-dataset.json`. The first browser launch copies that file into IndexedDB. After that, IndexedDB is the live store. The seed file is only the starting copy.

Other commands:

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
npx tsx scripts/verify-export.ts
```

`npx tsx scripts/verify-export.ts` rewrites [docs/verification-report.md](docs/verification-report.md) from the three fixture workbooks.

## What is stored where

- IndexedDB database `pms-workbench` holds the working dataset and a short undo stack.
- JSON download is a backup. Restoring it replaces the local dataset after confirmation.
- Chromium can also write that JSON to a file you pick. The write is reported only after it succeeds. Other browsers use download and restore.
- Excel export builds a new workbook. It does not modify the original files.

## Privacy

There is no sign-in. Browser storage is not encrypted. Export a backup before clearing site data or switching profiles. Do not put this workbook on a shared computer profile.

## Mapping

Field-by-field workbook notes are in [docs/workbook-analysis.md](docs/workbook-analysis.md). The export comparison is in [docs/verification-report.md](docs/verification-report.md). Limits and recovery are in [docs/limitations.md](docs/limitations.md).
