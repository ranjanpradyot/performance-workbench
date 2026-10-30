"use client";

import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { Alert, Box, Button, Link as MuiLink, Stack, Typography } from "@mui/material";
import NextLink from "next/link";
import { useState } from "react";
import { StatusChip } from "@/components/feedback/status-chip";
import { SegmentedTabs } from "@/components/molecule/segmented-tabs";
import { ChecklistEditor } from "@/components/reportees/editors";
import { KpiEditor } from "@/components/reportees/kpi-editor";
import { ReporteeDialog } from "@/components/reportees/reportee-dialog";
import { annualPointersUsed, kpiStartQuarterId, POINTER_CAP } from "@/domain/mutations";
import type { AchievementStatus, KpiDefinition, OkrChecklistEntry, Reportee, WorkbenchDataset } from "@/domain/types";
import { useWorkbench } from "@/state/workbench-context";
import { reporteeForeground } from "@/theme/reportee-colors";

const SECTIONS = [
  { id: "recovery", label: "Recovery", color: "#0A2A5C" },
  { id: "reportees", label: "Reportees", color: "#0E7A4D" },
  { id: "kpis", label: "KPIs", color: "#004FCC" },
  { id: "okrs", label: "OKRs", color: "#F88800" },
] as const;

const ARCHIVED_COLOR = "#6B7280";

export default function SettingsPage() {
  const { dataset, undo } = useWorkbench();
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("recovery");
  const [personId, setPersonId] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [kpiTarget, setKpiTarget] = useState<KpiDefinition | null>(null);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [okrTarget, setOkrTarget] = useState<OkrChecklistEntry | null>(null);
  const [okrOpen, setOkrOpen] = useState(false);
  const [reporteeTarget, setReporteeTarget] = useState<Reportee | null>(null);
  const [reporteeOpen, setReporteeOpen] = useState(false);
  if (!dataset) return <Typography>Loading settings…</Typography>;

  const archivedCount = dataset.reportees.filter((person) => person.status === "archived").length;
  const visible = dataset.reportees.filter((person) => person.status !== "archived" || showArchived || person.id === personId);
  const person = visible.find((item) => item.id === personId) ?? visible.find((item) => item.status === "active") ?? visible[0];
  const pendingFor = (id: string) => dataset.kpiAssessments.filter((row) => row.reporteeId === id && (row.status === "pending" || row.status === "insufficient_evidence")).length;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
        <Typography variant="h4">Settings</Typography>
        <Stack direction="row" spacing={1}>
          {section === "recovery" && <Button variant="outlined" onClick={() => void undo()}>Undo last saved change</Button>}
          {section === "reportees" && <Button variant="contained" onClick={() => { setReporteeTarget(null); setReporteeOpen(true); }}>Add reportee</Button>}
          {section === "kpis" && person && <Button variant="contained" onClick={() => { setKpiTarget(null); setKpiOpen(true); }}>Add KPI</Button>}
          {section === "okrs" && person && <Button variant="contained" onClick={() => { setOkrTarget(null); setOkrOpen(true); }}>Add OKR</Button>}
        </Stack>
      </Stack>
      <SegmentedTabs ariaLabel="Settings" value={section} onChange={(id) => setSection(id as (typeof SECTIONS)[number]["id"])} items={[...SECTIONS]} />
      {section === "recovery" && <Recovery />}
      {section === "reportees" && (
        <Stack spacing={1.5}>
          {archivedCount > 0 && (
            <Box><Button size="small" onClick={() => setShowArchived((value) => !value)}>{showArchived ? "Hide archived" : `Show archived (${archivedCount})`}</Button></Box>
          )}
          <ReporteeCatalog dataset={dataset} showArchived={showArchived} onEdit={(item) => { setReporteeTarget(item); setReporteeOpen(true); }} />
        </Stack>
      )}
      {section !== "recovery" && section !== "reportees" && (
        <Stack spacing={2}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <SegmentedTabs
              ariaLabel="Reportees"
              value={person?.id ?? ""}
              onChange={setPersonId}
              items={visible.map((item) => {
                const pending = pendingFor(item.id);
                return {
                  id: item.id,
                  label: item.status === "archived" ? `${item.fullName} (archived)` : item.fullName,
                  color: item.status === "archived" ? ARCHIVED_COLOR : item.themeColor,
                  badge: pending || undefined,
                  badgeLabel: pending ? `${pending} KPIs not assessed` : undefined,
                };
              })}
            />
            {archivedCount > 0 && (
              <Button size="small" onClick={() => setShowArchived((value) => !value)}>{showArchived ? "Hide archived" : `Show archived (${archivedCount})`}</Button>
            )}
          </Box>
          {person && section === "kpis" && <KpiCatalog dataset={dataset} person={person} onEdit={(definition) => { setKpiTarget(definition); setKpiOpen(true); }} />}
          {person && section === "okrs" && <OkrCatalog dataset={dataset} person={person} onEdit={(entry) => { setOkrTarget(entry); setOkrOpen(true); }} />}
          {!person && <Alert severity="info">Add a reportee before managing KPIs or OKRs.</Alert>}
        </Stack>
      )}
      <ReporteeDialog key={`${reporteeOpen}-${reporteeTarget?.id ?? "new-reportee"}`} open={reporteeOpen && section === "reportees"} person={reporteeTarget} onClose={() => setReporteeOpen(false)} onSaved={() => undefined} />
      {person && <KpiEditor personId={person.id} definition={kpiTarget} open={kpiOpen && section === "kpis"} onClose={() => setKpiOpen(false)} />}
      {person && <ChecklistEditor key={`${okrOpen}-${okrTarget?.id ?? "new-okr"}`} personId={person.id} personName={person.fullName} entry={okrTarget} open={okrOpen && section === "okrs"} onClose={() => setOkrOpen(false)} />}
    </Stack>
  );
}

function ReporteeCatalog({ dataset, showArchived, onEdit }: { dataset: WorkbenchDataset; showArchived: boolean; onEdit: (person: Reportee) => void }) {
  const rows = dataset.reportees
    .filter((item) => item.status !== "archived" || showArchived)
    .map((item) => ({ id: item.id, name: item.fullName, employeeId: item.employeeId || "—", role: item.role || "—", status: item.status === "archived" ? "Archived" : "Active" }));
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">Add or edit a reportee here. Archive keeps their quarters, tickets, and evidence.</Typography>
      <CatalogGrid
        rows={rows}
        columns={[
          { field: "name", headerName: "Name", flex: 1, minWidth: 160 },
          { field: "employeeId", headerName: "Employee ID", width: 140 },
          { field: "role", headerName: "Role", width: 140 },
          { field: "status", headerName: "Status", width: 120 },
          { field: "edit", headerName: "Edit", width: 90, sortable: false, valueGetter: () => "Edit", cellClassName: "link-cell" },
        ]}
        onEdit={(id) => {
          const item = dataset.reportees.find((person) => person.id === id);
          if (item) onEdit(item);
        }}
      />
    </Stack>
  );
}

function KpiCatalog({ dataset, person, onEdit }: { dataset: WorkbenchDataset; person: Reportee; onEdit: (definition: KpiDefinition) => void }) {
  const rows = dataset.kpiDefinitions
    .filter((item) => item.reporteeId === person.id && item.active)
    .sort((left, right) => right.year - left.year || left.displayOrder - right.displayOrder)
    .map((item) => {
      const startId = kpiStartQuarterId(dataset, item.id);
      return { id: item.id, year: item.year, name: item.sourceLabel, category: item.category, pointers: item.annualWeight, starts: dataset.quarters.find((quarter) => quarter.id === startId)?.label ?? "—" };
    });
  const years = [...new Set(rows.map((row) => row.year))].sort((left, right) => right - left);
  return (
    <Stack spacing={1.5}>
      <PersonBanner person={person} detail="Earlier quarters in the start year are not applicable and do not use pointers. A recorded Yes or No is kept. Pointers for one year cannot exceed 100." />
      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
        {years.map((year) => <Typography key={year} variant="body2">{year}: {annualPointersUsed(dataset, person.id, year)} of {POINTER_CAP} pointers</Typography>)}
      </Stack>
      <CatalogGrid
        rows={rows}
        columns={[
          { field: "year", headerName: "Year", width: 90 },
          { field: "name", headerName: "KPI", flex: 1, minWidth: 180 },
          { field: "category", headerName: "Category", width: 160 },
          { field: "pointers", headerName: "Pointers", width: 110 },
          { field: "starts", headerName: "Starts", width: 120 },
          { field: "edit", headerName: "Edit", width: 90, sortable: false, valueGetter: () => "Edit", cellClassName: "link-cell" },
        ]}
        onEdit={(id) => {
          const definition = dataset.kpiDefinitions.find((item) => item.id === id);
          if (definition) onEdit(definition);
        }}
      />
    </Stack>
  );
}

function OkrCatalog({ dataset, person, onEdit }: { dataset: WorkbenchDataset; person: Reportee; onEdit: (entry: OkrChecklistEntry) => void }) {
  const rows = dataset.okrChecklistEntries
    .filter((item) => item.reporteeId === person.id)
    .map((item) => ({ ...item, quarter: dataset.quarters.find((quarter) => quarter.id === item.quarterId)?.label ?? item.quarterId, statusValue: item.okrMet }));
  return (
    <Stack spacing={1.5}>
      <PersonBanner person={person} detail="A new OKR can mark earlier quarters this year as not applicable, with no pointers. Pointers on one quarter cannot exceed 100." />
      <CatalogGrid
        rows={rows}
        columns={[
          { field: "quarter", headerName: "Quarter", width: 120 },
          { field: "kpiAffected", headerName: "KPI", width: 180 },
          { field: "statusValue", headerName: "Met", width: 170, renderCell: (params) => <StatusChip status={params.value as AchievementStatus} /> },
          { field: "weightage", headerName: "Pointers", width: 110 },
          { field: "okrs", headerName: "OKR", flex: 1, minWidth: 240 },
          { field: "edit", headerName: "Edit", width: 90, sortable: false, valueGetter: () => "Edit", cellClassName: "link-cell" },
        ]}
        onEdit={(id) => {
          const entry = dataset.okrChecklistEntries.find((item) => item.id === id);
          if (entry) onEdit(entry);
        }}
      />
    </Stack>
  );
}

function PersonBanner({ person, detail }: { person: Reportee; detail: string }) {
  return (
    <Box sx={{ borderRadius: 2.5, px: 2.5, py: 2, color: reporteeForeground(person.themeColor), background: person.themeColor }}>
      <Typography variant="h5">{person.fullName}</Typography>
      <Typography sx={{ opacity: 0.92 }}>{detail}</Typography>
    </Box>
  );
}

function CatalogGrid({ rows, columns, onEdit }: { rows: Array<{ id: string }>; columns: GridColDef[]; onEdit: (id: string) => void }) {
  return (
    <Box sx={{ height: 560, bgcolor: "background.paper" }}>
      <DataGrid
        rows={rows}
        columns={columns}
        disableRowSelectionOnClick
        onCellClick={(params) => { if (params.field === "edit") onEdit(String(params.id)); }}
        getRowHeight={() => "auto"}
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        sx={{ "& .MuiDataGrid-cell": { py: 1, whiteSpace: "normal", lineHeight: 1.4, alignItems: "flex-start" }, "& .link-cell": { color: "primary.main", textDecoration: "underline", cursor: "pointer", fontWeight: 600 } }}
      />
    </Box>
  );
}

function Recovery() {
  const { dataset } = useWorkbench();
  return (
    <Stack spacing={2}>
      <Alert severity="warning">Browser data is not automatically encrypted or backed up. Clearing site data, or switching browser profile, removes the local workbook. Export JSON before you do either. There is no sign-in. Local access is not enterprise access control. Use a protected workstation.</Alert>
      <Typography>Schema {dataset?.schemaVersion}. Revision {dataset?.application.revision}. Last update {dataset?.application.updatedAt}.</Typography>
      <Typography>IndexedDB is the working copy. A downloaded JSON file is a backup. The app does not write that file unless you download it or connect a file below. Reportee, KPI, and OKR changes are made on the other tabs. The reportee pages stay the quarter view. Open <MuiLink component={NextLink} href="/reportees">Reportees</MuiLink> to read scores and evidence.</Typography>
      <FileSync />
      {dataset?.assessmentRules.map((rule) => (
        <Stack key={rule.id} spacing={0.5}>
          <Typography variant="h6">{dataset.reportees.find((person) => person.id === rule.reporteeId)?.fullName} rules v{rule.version}</Typography>
          <Typography variant="body2">Score model: {rule.scoreModel}. Velocity floor is {rule.velocity.thresholdRatio * 100}% of target. Spill is open ≤ {rule.spill.maxOpen} or spill ≤ {rule.spill.maxSpillPercent}%. SLA average ≤ {rule.sla.maxAverageCycleDays} days. Rework wait states {rule.rework.countWaitStates ? "count" : "do not count"}.</Typography>
          {rule.notes.map((note) => <Typography key={note} variant="body2">{note}</Typography>)}
        </Stack>
      ))}
      <Typography variant="body2">Audit entries: {dataset?.auditHistory.length ?? 0}</Typography>
    </Stack>
  );
}

function FileSync() {
  const { dataset, notify } = useWorkbench();
  const [fileName, setFileName] = useState<string>("");
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  const [permission, setPermission] = useState<"disconnected" | "connected" | "needs-permission">("disconnected");

  async function connect() {
    if (!window.showOpenFilePicker) {
      notify("This browser cannot connect a local JSON file. Use Download JSON backup instead.", "warning");
      return;
    }
    const [next] = await window.showOpenFilePicker({ types: [{ description: "JSON", accept: { "application/json": [".json"] } }] });
    const state = await next.queryPermission?.({ mode: "readwrite" });
    setHandle(next);
    setFileName(next.name);
    setPermission(state === "granted" ? "connected" : "needs-permission");
  }

  return (
    <Stack spacing={1}>
      <Typography variant="h6">Optional JSON file</Typography>
      <Typography variant="body2">Status: {permission === "connected" ? `connected to ${fileName}` : permission === "needs-permission" ? `${fileName} needs permission` : "disconnected"}. IndexedDB stays usable either way. Permission is requested only after you click.</Typography>
      <Button variant="outlined" onClick={() => void connect()}>Connect a JSON file</Button>
      <Button variant="outlined" disabled={!handle || !dataset} onClick={async () => {
        if (!handle || !dataset) return;
        try {
          const granted = await handle.requestPermission?.({ mode: "readwrite" });
          if (granted && granted !== "granted") {
            setPermission("needs-permission");
            notify("Permission was not granted. The file was not written.", "warning");
            return;
          }
          const existing = await (await handle.getFile()).text();
          if (existing.trim()) {
            try {
              const parsed = JSON.parse(existing) as { application?: { revision?: number; updatedAt?: string } };
              const fileRevision = parsed.application?.revision ?? 0;
              if (fileRevision > dataset.application.revision) {
                const proceed = window.confirm(`The file is at revision ${fileRevision}, which is newer than this browser copy (${dataset.application.revision}). Overwrite it with the browser copy?`);
                if (!proceed) {
                  notify("The file was not changed.", "warning");
                  return;
                }
              }
            } catch {
              const proceed = window.confirm("The selected file is not valid JSON. Replace it with the current workbook?");
              if (!proceed) {
                notify("The file was not changed.", "warning");
                return;
              }
            }
          }
          const writable = await handle.createWritable();
          await writable.write(JSON.stringify(dataset, null, 2));
          await writable.close();
          setPermission("connected");
          notify(`The file ${handle.name} was written at revision ${dataset.application.revision}.`);
        } catch (cause) {
          notify(cause instanceof Error ? `The file was not updated. ${cause.message}` : "The file was not updated.", "error");
        }
      }}>Write the current workbook to the connected file</Button>
    </Stack>
  );
}
