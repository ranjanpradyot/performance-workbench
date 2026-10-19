"use client";

import { Alert, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { migrateDataset } from "@/domain/schema";
import { commitTicketRows, previewTicketCsv } from "@/infrastructure/csv/tickets";
import { exportReporteeWorkbook } from "@/infrastructure/excel/export-workbook";
import { importWorkbook } from "@/infrastructure/excel/import-workbook";
import { mergeImport, useWorkbench } from "@/state/workbench-context";

export default function ImportPage() {
  const { dataset, commit, notify } = useWorkbench();
  const [summary, setSummary] = useState<string>("");
  const [pending, setPending] = useState<Awaited<ReturnType<typeof importWorkbook>> | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvReportee, setCsvReportee] = useState("");
  const reporteeId = csvReportee || dataset?.reportees[0]?.id || "";
  const csvPreview = useMemo(() => (dataset && csvText.trim() ? previewTicketCsv(csvText, reporteeId, dataset.tickets) : null), [csvText, dataset, reporteeId]);

  async function onFile(file: File) {
    const buffer = await file.arrayBuffer();
    const result = await importWorkbook(buffer, file.name, dataset?.reportees.length ?? 0);
    setPending(result);
    setSummary(`${file.name}: ${result.sheetNames.length} sheets, ${result.dataset.tickets.length} tickets, ${result.dataset.okrChecklistEntries.length} checklist lines, ${result.warnings.length} warnings.`);
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Import and export</Typography>
      <Alert severity="info">Imports are previewed before they change the local workbook. Cancel leaves the current data untouched.</Alert>
      <Button variant="contained" component="label">Choose Excel workbook<input hidden type="file" accept=".xlsx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onFile(file); }} /></Button>
      {summary && <Typography>{summary}</Typography>}
      {pending && <Typography variant="body2">Sheets: {pending.sheetNames.join(", ")}</Typography>}
      {pending && (
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={() => {
            if (!dataset) return;
            void commit(mergeImport(dataset, pending.dataset), `Import ${pending.dataset.application.seededFrom.join(", ")}`).then(() => {
              notify("Import saved locally.");
              setPending(null);
            });
          }}>Commit import</Button>
          <Button onClick={() => { setPending(null); setSummary("Import cancelled. Existing data was not changed."); }}>Cancel</Button>
        </Stack>
      )}
      {pending?.warnings.slice(0, 12).map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
      <Typography variant="h6">Ticket CSV or paste</Typography>
      <Typography variant="body2">Paste ticket-master columns, including the header. Nothing is saved until every row is valid and you confirm.</Typography>
      <TextField select label="Reportee" value={reporteeId} onChange={(event) => setCsvReportee(event.target.value)}>
        {dataset?.reportees.map((person) => <MenuItem key={person.id} value={person.id}>{person.fullName}</MenuItem>)}
      </TextField>
      <TextField label="CSV" multiline minRows={4} value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder={"Ticket No.,Description,Status,Assign Date,Closure Date,Code Lines Changed,Quarter"} />
      <Button component="label" variant="outlined">Load CSV file<input hidden type="file" accept=".csv,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setCsvText(await file.text()); }} /></Button>
      {csvPreview && <Typography>{csvPreview.ready.length} valid rows. {csvPreview.issues.length} rows need a correction.</Typography>}
      {csvPreview?.issues.slice(0, 8).map((issue) => <Alert key={`${issue.row}-${issue.column}`} severity="warning">Row {issue.row}, {issue.column}: {issue.value || "blank"}. {issue.message} {issue.suggestion}</Alert>)}
      <Stack direction="row" spacing={1}>
        <Button variant="contained" disabled={!dataset || !csvPreview || csvPreview.issues.length > 0 || csvPreview.ready.length === 0} onClick={() => {
          if (!dataset || !csvPreview) return;
          void commit(commitTicketRows(dataset, csvPreview.ready), "Import tickets from CSV").then(() => {
            notify(`${csvPreview.ready.length} tickets saved.`);
            setCsvText("");
          });
        }}>Save valid ticket rows</Button>
        <Button disabled={!csvText} onClick={() => setCsvText("")}>Clear paste</Button>
      </Stack>
      <Typography variant="h6">Export</Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
        {dataset?.reportees.map((person) => (
          <Button key={person.id} variant="outlined" onClick={() => {
            void exportReporteeWorkbook(dataset, person.id).then((buffer) => download(`${person.fullName}_OKR_Checklist.xlsx`, buffer));
          }}>Export {person.fullName}</Button>
        ))}
      </Stack>
      <Button variant="outlined" onClick={() => {
        if (!dataset) return;
        const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "pms-workbench-backup.json";
        anchor.click();
        URL.revokeObjectURL(url);
      }}>Download JSON backup</Button>
      <Button component="label" variant="outlined">Restore JSON<input hidden type="file" accept="application/json" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file || !dataset) return;
        try {
          const parsed = migrateDataset(JSON.parse(await file.text()));
          if (!parsed.ok) {
            notify(parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join(" "), "error");
            return;
          }
          if (!window.confirm("Replace the local workbook with this backup?")) return;
          await commit(parsed.dataset, "Restore JSON");
        } catch {
          notify("The file is not valid JSON.", "error");
        }
      }} /></Button>
    </Stack>
  );
}

function download(name: string, buffer: ArrayBuffer | { byteLength: number }) {
  const blob = new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
