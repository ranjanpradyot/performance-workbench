# Canonical dataset

Schema version 1. The TypeScript source is `src/domain/types.ts`. Runtime checks are in `src/domain/schema.ts`.

A backup is one JSON object:

- `schemaVersion`
- `application` — name, revision, timestamps, seed file names
- `reportees`
- `appraisalYears`
- `quarters`
- `kpiDefinitions`
- `kpiAssessments`
- `okrChecklistEntries`
- `tickets`
- `learningEvidence`
- `processAssessments`
- `scorecardLines`
- `metricSnapshots`
- `documentNotes`
- `sheetNarratives`
- `supportingLinks`
- `assessmentRules`
- `exportProfiles`
- `auditHistory`

Relationships use stable ids. A reportee rename does not change `rep_…` ids, so quarters, tickets, and KPI rows stay attached.

The sample that the app loads on first run is `public/seed/initial-dataset.json`, produced by `npm run seed` from the three workbooks.
