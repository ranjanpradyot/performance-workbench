"use client";

import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import RestoreOutlinedIcon from "@mui/icons-material/RestoreOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import {
  Alert,
  Avatar,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState, type ReactNode } from "react";
import { migrateDataset } from "@/domain/schema";
import type { WorkbenchDataset } from "@/domain/types";
import { replaceReportee, sliceReportee } from "@/infrastructure/excel/dataset";
import { exportReporteeWorkbook } from "@/infrastructure/excel/export-workbook";
import { importWorkbook } from "@/infrastructure/excel/import-workbook";
import { sourceWorkbookFor } from "@/infrastructure/excel/source-workbooks";
import { useWorkbench } from "@/state/workbench-context";

type Pending =
  | { kind: "excel"; reporteeId: string; fileName: string; incoming: WorkbenchDataset; warnings: string[]; sheets: string[] }
  | { kind: "json"; reporteeId: string; fileName: string; incoming: WorkbenchDataset };

export default function ImportPage() {
  const { dataset, commit, notify } = useWorkbench();
  const [pending, setPending] = useState<Pending | null>(null);
  const people = dataset?.reportees.filter((person) => person.status !== "archived") ?? [];
  const target = people.find((person) => person.id === pending?.reporteeId);

  async function chooseExcel(reporteeId: string, file: File) {
    if (!dataset) return;
    const person = dataset.reportees.find((item) => item.id === reporteeId);
    if (!person) return;
    const result = await importWorkbook(await file.arrayBuffer(), file.name, dataset.reportees.length);
    if (!namesMatch(person.fullName, result.dataset)) {
      notify(`This workbook is for ${namesOf(result.dataset)}, not ${person.fullName}.`, "error");
      return;
    }
    setPending({
      kind: "excel",
      reporteeId,
      fileName: file.name,
      incoming: result.dataset,
      warnings: result.warnings,
      sheets: result.sheetNames,
    });
  }

  async function chooseJson(reporteeId: string, file: File) {
    if (!dataset) return;
    const person = dataset.reportees.find((item) => item.id === reporteeId);
    if (!person) return;
    try {
      const parsed = migrateDataset(JSON.parse(await file.text()));
      if (!parsed.ok) {
        notify(parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join(" "), "error");
        return;
      }
      if (!namesMatch(person.fullName, parsed.dataset)) {
        notify(`This backup does not contain ${person.fullName}.`, "error");
        return;
      }
      setPending({ kind: "json", reporteeId, fileName: file.name, incoming: parsed.dataset });
    } catch {
      notify("The file is not valid JSON.", "error");
    }
  }

  async function apply() {
    if (!dataset || !pending || !target) return;
    const next = replaceReportee(dataset, pending.incoming, pending.reporteeId);
    const label = pending.kind === "excel" ? `Import Excel for ${target.fullName}` : `Restore JSON for ${target.fullName}`;
    await commit(next, label);
    notify(`${target.fullName} was updated. The other reportees were left as they are.`);
    setPending(null);
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Import and export</Typography>
      <Typography color="text.secondary">
        Each row is one reportee. Import replaces only that person, after you confirm. Export Excel downloads their linked checklist with the same sheets, columns, and layout as the source workbook.
      </Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap", color: "text.secondary" }}>
        <Legend icon={<FileUploadOutlinedIcon fontSize="small" />} label="Import Excel" />
        <Legend icon={<TableChartOutlinedIcon fontSize="small" />} label="Export Excel" />
        <Legend icon={<DownloadOutlinedIcon fontSize="small" />} label="Download JSON" />
        <Legend icon={<RestoreOutlinedIcon fontSize="small" />} label="Restore JSON" />
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Reportee</TableCell>
              <TableCell>Excel workbook</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {people.map((person) => {
              const workbook = sourceWorkbookFor(person.fullName);
              return (
                <TableRow key={person.id} hover selected={pending?.reporteeId === person.id}>
                  <TableCell>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: person.themeColor, fontSize: 14 }}>{person.fullName.slice(0, 1)}</Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>{person.fullName}</Typography>
                        <Typography variant="caption" color="text.secondary">{person.role || "Role not recorded"}</Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>{workbook ?? "Built from the saved records"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={`Import Excel for ${person.fullName}`}>
                      <IconButton component="label" aria-label={`Import Excel for ${person.fullName}`} color="primary">
                        <FileUploadOutlinedIcon />
                        <input
                          hidden
                          type="file"
                          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void chooseExcel(person.id, file);
                          }}
                        />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={workbook ? `Export ${workbook}` : `Export Excel for ${person.fullName}`}>
                      <IconButton
                        aria-label={`Export Excel for ${person.fullName}`}
                        color="primary"
                        {...(workbook
                          ? { component: "a", href: `/api/workbooks?file=${encodeURIComponent(workbook)}` }
                          : {
                              onClick: () => {
                                if (!dataset) return;
                                void exportReporteeWorkbook(dataset, person.id).then((buffer) => downloadExcel(`${person.fullName}_OKR_Checklist.xlsx`, buffer));
                              },
                            })}
                      >
                        <TableChartOutlinedIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={`Download JSON for ${person.fullName}`}>
                      <IconButton
                        aria-label={`Download JSON for ${person.fullName}`}
                        onClick={() => {
                          if (!dataset) return;
                          downloadJson(`${person.fullName}-pms-backup.json`, sliceReportee(dataset, person.id));
                        }}
                      >
                        <DownloadOutlinedIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={`Restore JSON for ${person.fullName}`}>
                      <IconButton component="label" aria-label={`Restore JSON for ${person.fullName}`}>
                        <RestoreOutlinedIcon />
                        <input
                          hidden
                          type="file"
                          accept="application/json,.json"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void chooseJson(person.id, file);
                          }}
                        />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {people.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>No active reportees. Add one from Settings.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {pending && target && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.25}>
            <Typography sx={{ fontWeight: 600 }}>
              {pending.kind === "excel" ? `Replace ${target.fullName} with ${pending.fileName}?` : `Restore ${target.fullName} from ${pending.fileName}?`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {countLine(pending.incoming, target.fullName)} The other reportees stay as they are. Cancel leaves the current data untouched.
            </Typography>
            {pending.kind === "excel" && (
              <Typography variant="body2" color="text.secondary">Sheets: {pending.sheets.join(", ")}</Typography>
            )}
            {pending.kind === "excel" && pending.warnings.slice(0, 8).map((warning) => (
              <Alert key={warning} severity="warning">{warning}</Alert>
            ))}
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={() => void apply()}>Replace {target.fullName}</Button>
              <Button onClick={() => setPending(null)}>Cancel</Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

function Legend({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
      {icon}
      <Typography variant="body2">{label}</Typography>
    </Stack>
  );
}

function namesMatch(fullName: string, incoming: WorkbenchDataset): boolean {
  const name = fullName.trim().toLowerCase();
  return incoming.reportees.some((person) => person.fullName.trim().toLowerCase() === name);
}

function namesOf(incoming: WorkbenchDataset): string {
  return incoming.reportees.map((person) => person.fullName).join(", ") || "someone else";
}

function countLine(incoming: WorkbenchDataset, fullName: string): string {
  const person = incoming.reportees.find((item) => item.fullName.trim().toLowerCase() === fullName.trim().toLowerCase());
  const id = person?.id;
  const tickets = incoming.tickets.filter((row) => row.reporteeId === id).length;
  const lines = incoming.okrChecklistEntries.filter((row) => row.reporteeId === id).length;
  const kpis = incoming.kpiDefinitions.filter((row) => row.reporteeId === id).length;
  return `${tickets} tickets, ${lines} checklist lines, ${kpis} KPIs.`;
}

function downloadJson(name: string, data: WorkbenchDataset) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadExcel(name: string, buffer: ArrayBuffer | { byteLength: number }) {
  const blob = new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
