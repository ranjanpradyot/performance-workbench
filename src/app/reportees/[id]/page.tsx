"use client";

import { DataGrid, useGridApiRef, type GridColDef } from "@mui/x-data-grid";
import { Alert, Box, Button, Chip, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StatusChip, StatusIcon } from "@/components/feedback/status-chip";
import { PageFilters, SelectField, STATUS_OPTIONS } from "@/components/layout/filter-bar";
import { ChecklistEditor, LearningEditor, OverrideEditor, TicketEditor } from "@/components/reportees/editors";
import { QuarterScoreCard, StatusLegend } from "@/components/scores/quarter-score";
import { quarterScores } from "@/domain/dashboard";
import { linkLabel, okrTitle, parseWorkbookLink, sheetLabel, type WorkbookLink } from "@/domain/sheet-links";
import type { AchievementStatus, KpiAssessment, LearningEvidence, OkrChecklistEntry, Ticket } from "@/domain/types";
import { useWorkbench } from "@/state/workbench-context";
import { reporteeForeground } from "@/theme/reportee-colors";

const SECTIONS = [
  ["overview", "Overview"],
  ["kpis", "KPIs"],
  ["checklist", "OKR checklist"],
  ["tickets", "Ticket master"],
  ["quarters", "Quarter tickets"],
  ["learning", "Learning"],
  ["quality", "Quality and process"],
  ["scorecard", "Scorecard"],
  ["notes", "Notes"],
] as const;

export default function ReporteeWorkspacePage() {
  const params = useParams<{ id: string }>();
  const { dataset, filters } = useWorkbench();
  const [section, setSection] = useState<(typeof SECTIONS)[number][0]>("overview");
  const [quarterFilter, setQuarterFilter] = useState(filters.quarterId);
  const [statusFilter, setStatusFilter] = useState("all");
  const [checklistTarget, setChecklistTarget] = useState<OkrChecklistEntry | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [ticketTarget, setTicketTarget] = useState<Ticket | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [learningTarget, setLearningTarget] = useState<LearningEvidence | null>(null);
  const [learningOpen, setLearningOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<KpiAssessment | null>(null);
  const [focusChecklistId, setFocusChecklistId] = useState<string | null>(null);
  const [focusSheet, setFocusSheet] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState<WorkbookLink | null>(null);
  const person = dataset?.reportees.find((item) => item.id === params.id);
  const rows = useMemo(() => {
    if (!dataset || !person) return null;
    const quarter = quarterFilter;
    const inQuarter = <T extends { quarterId?: string }>(items: T[]) => items.filter((item) => quarter === "all" || item.quarterId === quarter);
    const hasStatus = (status: AchievementStatus, overridden = false) => statusFilter === "all" || (statusFilter === "overridden" ? overridden || status === "overridden" : status === statusFilter);
    return {
      kpis: inQuarter(dataset.kpiAssessments.filter((item) => item.reporteeId === person.id && hasStatus(item.status, item.manualOverride))),
      checklist: inQuarter(dataset.okrChecklistEntries.filter((item) => item.reporteeId === person.id && hasStatus(item.okrMet))),
      tickets: inQuarter(dataset.tickets.filter((item) => item.reporteeId === person.id)),
      learning: inQuarter(dataset.learningEvidence.filter((item) => item.reporteeId === person.id && hasStatus(item.status))),
      scorecard: inQuarter(dataset.scorecardLines.filter((item) => item.reporteeId === person.id && hasStatus(item.status))),
      scores: quarterScores(dataset, person.id, quarter === "all" ? undefined : [quarter]),
      rules: dataset.assessmentRules.find((item) => item.reporteeId === person.id),
      process: dataset.processAssessments.find((item) => item.reporteeId === person.id),
      notes: dataset.documentNotes.filter((item) => item.reporteeId === person.id),
    };
  }, [dataset, person, quarterFilter, statusFilter]);

  if (!dataset || !person || !rows) return <Typography>That reportee is not in the local workbook.</Typography>;

  const followWorkbookLink = (raw: string) => {
    const link = parseWorkbookLink(raw);
    setLinkNote(link);
    if (link.kind === "url" && link.url) {
      window.open(link.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (link.kind !== "sheet" || !link.section) return;
    if (link.section === "checklist") {
      const entry = dataset.okrChecklistEntries.find((item) => item.reporteeId === person.id && item.sourceRow === link.row);
      setFocusChecklistId(entry?.id ?? null);
      setFocusSheet(link.sheet ?? null);
      if (entry) {
        setStatusFilter("all");
        if (entry.quarterId) setQuarterFilter(entry.quarterId);
      }
      setSection("checklist");
      return;
    }
    setFocusChecklistId(null);
    setFocusSheet(link.sheet ?? null);
    if (link.quarterId) {
      setStatusFilter("all");
      setQuarterFilter(link.quarterId);
    }
    setSection(link.section);
  };

  const labelFor = (raw?: string | null) => {
    if (!raw) return "";
    const link = parseWorkbookLink(raw);
    const entry = link.section === "checklist" ? dataset.okrChecklistEntries.find((item) => item.reporteeId === person.id && item.sourceRow === link.row) : undefined;
    return linkLabel(link, entry ? okrTitle(entry.okrs) : undefined);
  };

  const followAssessment = (id: string) => {
    const assessment = dataset.kpiAssessments.find((item) => item.id === id);
    const ref = assessment?.evidenceRefs.find((item) => item.includes("!"));
    if (ref) followWorkbookLink(ref);
  };
  const mine = (item: { reporteeId: string; quarterId?: string }, quarterId: string) => item.reporteeId === person.id && item.quarterId === quarterId;
  const personQuarters = [...dataset.quarters]
    .sort((a, b) => a.year - b.year || a.quarterNumber - b.quarterNumber)
    .filter((quarter) => quarter.id === quarterFilter || [dataset.kpiAssessments, dataset.okrChecklistEntries, dataset.tickets, dataset.learningEvidence].some((items) => items.some((item) => mine(item, quarter.id))));
  return (
    <Stack spacing={2}>
      <Box sx={{ borderRadius: 2.5, px: 2.5, py: 2, color: reporteeForeground(person.themeColor), background: person.themeColor }}>
        <Typography variant="h4">{person.fullName}</Typography>
        <Typography sx={{ opacity: 0.92 }}>{[person.role, person.employeeId ? `Employee ${person.employeeId}` : "Employee ID not in the source workbook", person.manager ? `Manager ${person.manager}` : null, person.status].filter(Boolean).join(" · ")}</Typography>
      </Box>
      <Tabs value={section} onChange={(_event, value) => setSection(value)} variant="scrollable" sx={{ "& .MuiTabs-indicator": { backgroundColor: person.themeColor, height: 3 }, "& .Mui-selected": { color: `${person.themeColor} !important` } }}>
        {SECTIONS.map(([id, label]) => <Tab key={id} value={id} label={label} />)}
      </Tabs>
      <PageFilters>
        <SelectField label="Quarter" value={quarterFilter} onChange={setQuarterFilter} options={[["all", "All quarters"], ...personQuarters.map((quarter) => [quarter.id, quarter.label] as [string, string])]} />
        <SelectField label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
        <Typography variant="body2" color="text.secondary">Quarter filter: {quarterFilter === "all" ? "All quarters" : labelOf(dataset, quarterFilter)}</Typography>
      </PageFilters>
      {linkNote && <LinkNote link={linkNote} label={labelFor(linkNote.raw)} />}
      {section === "overview" && (
        <Stack spacing={1.5}>
          <Alert severity="info">{rows.rules?.notes[0]}</Alert>
          <Typography>{rows.tickets.length} tickets in view. {rows.checklist.length} checklist lines. {rows.learning.length} learning records.</Typography>
          {person.notes && <Typography>{person.notes}</Typography>}
          <Typography variant="h6">Quarter-wise score</Typography>
          <StatusLegend />
          {rows.scores.length === 0 && <Typography color="text.secondary">No KPI assessments in this quarter.</Typography>}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }, gap: 1.5 }}>
            {rows.scores.map((score) => <QuarterScoreCard key={score.quarterId} score={score} color={person.themeColor} onKpiClick={followAssessment} />)}
          </Box>
        </Stack>
      )}
      {section === "kpis" && (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">Select a KPI or its linked OKR to open that OKR. Override has its own column. The calculated status is kept.</Typography>
          <Grid
            rows={rows.kpis.map((row) => ({ ...row, quarter: labelOf(dataset, row.quarterId), kpi: dataset.kpiDefinitions.find((item) => item.id === row.kpiDefinitionId)?.sourceLabel, okrLink: row.evidenceRefs[0] ?? "", okrLinkLabel: labelFor(row.evidenceRefs[0]), statusValue: row.status, overridden: row.manualOverride }))}
            columns={kpiColumns}
            onCellClick={(id, field) => {
              if (field === "override") {
                setOverrideTarget(rows.kpis.find((item) => item.id === id) ?? null);
                return;
              }
              if (field === "kpi" || field === "okrLink") {
                const ref = rows.kpis.find((item) => item.id === id)?.evidenceRefs[0];
                if (ref) followWorkbookLink(ref);
              }
            }}
          />
        </Stack>
      )}
      {section === "checklist" && (
        <Stack spacing={1}>
          <Button sx={{ alignSelf: "flex-start" }} variant="contained" onClick={() => { setChecklistTarget(null); setChecklistOpen(true); }}>Add OKR</Button>
          <Grid
            rows={rows.checklist.map((row) => ({ ...row, quarter: labelOf(dataset, row.quarterId), statusValue: row.okrMet, artifactsLabel: labelFor(row.artifacts), otherLinksLabel: labelFor(row.otherLinks) }))}
            columns={checklistColumns}
            highlightId={focusChecklistId}
            onCellClick={(id, field, value) => {
              if ((field === "artifacts" || field === "otherLinks") && typeof value === "string" && value) {
                followWorkbookLink(value);
                return;
              }
              setChecklistTarget(rows.checklist.find((item) => item.id === id) ?? null);
              setChecklistOpen(true);
            }}
          />
        </Stack>
      )}
      {section === "tickets" && (
        <Stack spacing={1}>
          <Button sx={{ alignSelf: "flex-start" }} variant="contained" onClick={() => { setTicketTarget(null); setTicketOpen(true); }}>Add ticket</Button>
          <Grid rows={rows.tickets.map((row) => ({ ...row, quarter: row.quarterId ? labelOf(dataset, row.quarterId) : "" }))} columns={ticketColumns} onCellClick={(id) => { setTicketTarget(rows.tickets.find((item) => item.id === id) ?? null); setTicketOpen(true); }} />
        </Stack>
      )}
      {section === "quarters" && <QuarterTickets dataset={dataset} reporteeId={person.id} />}
      {section === "learning" && (
        <Stack spacing={1}>
          <Button sx={{ alignSelf: "flex-start" }} variant="contained" onClick={() => { setLearningTarget(null); setLearningOpen(true); }}>Add learning evidence</Button>
          <Grid rows={rows.learning.map((row) => ({ ...row, quarter: labelOf(dataset, row.quarterId), statusValue: row.status, evidenceLinkLabel: labelFor(row.evidenceLink) }))} columns={learningColumns} onCellClick={(id, field, value) => {
            if (field === "evidenceLink" && typeof value === "string" && value) {
              followWorkbookLink(value);
              return;
            }
            setLearningTarget(rows.learning.find((item) => item.id === id) ?? null);
            setLearningOpen(true);
          }} />
        </Stack>
      )}
      {section === "quality" && <QualityPanel process={rows.process} snapshots={dataset.metricSnapshots.filter((item) => item.reporteeId === person.id)} focusSheet={focusSheet} />}
      {section === "scorecard" && (
        <Grid
          rows={rows.scorecard.map((row) => ({ ...row, quarter: labelOf(dataset, row.quarterId), statusValue: row.status, evidenceSheetLabel: labelFor(row.evidenceSheet) }))}
          columns={scoreColumns}
          onCellClick={(_id, field, value) => {
            if (field === "evidenceSheet" && typeof value === "string" && value) followWorkbookLink(value);
          }}
        />
      )}
      {section === "notes" && (
        <Stack spacing={1}>
          {rows.notes.length === 0 && <Typography color="text.secondary">This workbook has no document-summary notes.</Typography>}
          {rows.notes.map((note) => <Typography key={note.id}><strong>{note.version} · {note.area}.</strong> {note.change}</Typography>)}
          {rows.rules?.notes.map((note) => <Alert key={note} severity="warning">{note}</Alert>)}
        </Stack>
      )}
      <ChecklistEditor personId={person.id} personName={person.fullName} entry={checklistTarget} open={checklistOpen} onClose={() => setChecklistOpen(false)} />
      <TicketEditor personId={person.id} entry={ticketTarget} open={ticketOpen} onClose={() => setTicketOpen(false)} />
      <LearningEditor personId={person.id} entry={learningTarget} open={learningOpen} onClose={() => setLearningOpen(false)} />
      <OverrideEditor assessment={overrideTarget} open={Boolean(overrideTarget)} onClose={() => setOverrideTarget(null)} />
    </Stack>
  );
}

function labelOf(dataset: NonNullable<ReturnType<typeof useWorkbench>["dataset"]>, quarterId: string): string {
  return dataset.quarters.find((item) => item.id === quarterId)?.label ?? quarterId;
}

function Grid({ rows, columns, highlightId, onCellClick }: { rows: Array<{ id: string }>; columns: GridColDef[]; highlightId?: string | null; onCellClick?: (id: string, field: string, value: unknown) => void }) {
  const apiRef = useGridApiRef();
  useEffect(() => {
    const api = apiRef.current;
    if (!highlightId || !api?.getRowIndexRelativeToVisibleRows) return;
    const index = api.getRowIndexRelativeToVisibleRows(highlightId);
    if (index < 0) return;
    const pageSize = api.state.pagination?.paginationModel.pageSize ?? rows.length;
    if (pageSize > 0) api.setPage(Math.floor(index / pageSize));
  }, [apiRef, highlightId, rows]);
  return (
    <Box sx={{ height: 560, bgcolor: "background.paper" }}>
      <DataGrid
        apiRef={apiRef}
        rows={rows}
        columns={columns}
        disableRowSelectionOnClick
        onCellClick={(params) => onCellClick?.(String(params.id), params.field, params.value)}
        getRowClassName={(params) => (params.id === highlightId ? "linked-row" : "")}
        getRowHeight={() => "auto"}
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        sx={{ "& .MuiDataGrid-cell": { py: 1, whiteSpace: "normal", lineHeight: 1.4, alignItems: "flex-start" }, "& .linked-row": { bgcolor: "rgba(110,155,255,0.16)" }, "& .link-cell": { color: "primary.main", textDecoration: "underline", cursor: "pointer", fontWeight: 600 } }}
      />
    </Box>
  );
}

function statusColumn(headerName: string, width = 190): GridColDef {
  return {
    field: "statusValue",
    headerName,
    width,
    renderCell: (params) => <StatusChip status={params.value as AchievementStatus} overridden={Boolean(params.row.overridden)} />,
  };
}

/** Shows the plain-language label beside the stored reference, so clicks still receive the stored value. */
function linkCell(field: string, headerName: string, size: { width?: number; flex?: number }): GridColDef {
  return {
    field,
    headerName,
    ...size,
    cellClassName: (params) => (params.value ? "link-cell" : ""),
    renderCell: (params) => (params.row[`${field}Label`] as string | undefined) || (params.value as string | undefined) || "",
  };
}

const kpiColumns: GridColDef[] = [
  { field: "quarter", headerName: "Quarter", width: 100 },
  { field: "kpi", headerName: "KPI", width: 160, cellClassName: (params) => (params.row.okrLink ? "link-cell" : "") },
  linkCell("okrLink", "Linked OKR", { width: 190 }),
  statusColumn("Status", 150),
  { field: "weightUsed", headerName: "Weight", width: 80 },
  { field: "target", headerName: "Target", flex: 1, minWidth: 180 },
  { field: "actual", headerName: "Actual", flex: 1, minWidth: 160 },
  { field: "override", headerName: "Override", width: 100, sortable: false, valueGetter: () => "Override", cellClassName: "link-cell" },
];

const checklistColumns: GridColDef[] = [
  { field: "quarter", headerName: "Quarter", width: 110 },
  { field: "kpiAffected", headerName: "KPI", width: 160 },
  statusColumn("Met"),
  { field: "weightage", headerName: "Weight", width: 90 },
  { field: "okrs", headerName: "OKR", flex: 1.2 },
  linkCell("artifacts", "Evidence", { flex: 1 }),
  linkCell("otherLinks", "More evidence", { flex: 1 }),
];

const ticketColumns: GridColDef[] = [
  { field: "ticketNo", headerName: "Ticket", width: 110 },
  { field: "description", headerName: "Description", flex: 1 },
  { field: "status", headerName: "Status", width: 140 },
  { field: "quarter", headerName: "Quarter", width: 110 },
  { field: "assignDate", headerName: "Assigned", width: 120 },
  { field: "closureDate", headerName: "Closed", width: 120 },
  { field: "codeLines", headerName: "Code lines", width: 110 },
  { field: "sqlLines", headerName: "SQL lines", width: 110 },
  { field: "cycleDays", headerName: "Cycle days", width: 110 },
];

const learningColumns: GridColDef[] = [
  { field: "quarter", headerName: "Quarter", width: 110 },
  { field: "kpi", headerName: "KPI", width: 180 },
  { field: "focusArea", headerName: "POC / focus", flex: 1 },
  statusColumn("Status"),
  linkCell("evidenceLink", "Evidence", { flex: 1 }),
];

const scoreColumns: GridColDef[] = [
  { field: "quarter", headerName: "Quarter", width: 110 },
  { field: "kpiArea", headerName: "KPI", width: 220 },
  { field: "metric", headerName: "Metric", width: 200 },
  statusColumn("Status"),
  { field: "weightage", headerName: "Weight", width: 90 },
  { field: "actual", headerName: "Actual", flex: 1 },
  linkCell("evidenceSheet", "Evidence", { width: 240 }),
];

function QuarterTickets({ dataset, reporteeId }: { dataset: NonNullable<ReturnType<typeof useWorkbench>["dataset"]>; reporteeId: string }) {
  const quarters = dataset.quarters.filter((quarter) => dataset.tickets.some((ticket) => ticket.reporteeId === reporteeId && ticket.quarterId === quarter.id));
  return (
    <Stack spacing={1}>
      {quarters.map((quarter) => {
        const count = dataset.tickets.filter((ticket) => ticket.reporteeId === reporteeId && ticket.quarterId === quarter.id).length;
        return <Chip key={quarter.id} label={`${quarter.label}: ${count} tickets`} sx={{ alignSelf: "flex-start" }} />;
      })}
      {quarters.length === 0 && <Typography>No quarterly ticket evidence in the current data.</Typography>}
    </Stack>
  );
}

function LinkNote({ link, label }: { link: WorkbookLink; label: string }) {
  if (link.kind === "url") return <Alert severity="info">Opened {label} in a new tab.</Alert>;
  if (link.kind === "file") return <Alert severity="warning">{label} is a file outside this appraisal, so it cannot be opened here.</Alert>;
  if (link.section === "checklist" && link.row === 1) return <Alert severity="warning">No OKR line yet. This KPI has no OKR recorded for the quarter.</Alert>;
  if (link.section === "checklist") return <Alert severity="info">Showing {label}. The linked OKR is highlighted.</Alert>;
  return <Alert severity="info">Showing {label}.</Alert>;
}

function QualityPanel({ process, snapshots, focusSheet }: { process?: { narrative?: string; overallStatus: string; scorecard: Array<{ item: string; overall?: string; comments?: string }> }; snapshots: Array<{ id: string; sheet: string; values: Record<string, string>; status?: AchievementStatus }>; focusSheet: string | null }) {
  const shown = focusSheet
    ? snapshots.filter((item) => item.sheet === focusSheet)
    : snapshots.filter((item) => ["SLA_CycleDays", "Ticket_Spillover", "Rework_Reopen_Proxy", "Customer_Defect_Themes"].includes(item.sheet)).slice(0, 12);
  return (
    <Stack spacing={1}>
      {focusSheet && <Typography variant="h6">{sheetLabel(focusSheet)}</Typography>}
      <Typography>{process?.narrative}</Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography>Process overall:</Typography>
        <StatusChip status={(process?.overallStatus ?? "pending") as AchievementStatus} />
      </Stack>
      {process?.scorecard.map((row) => (
        <Stack key={row.item} direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <StatusIcon status={(row.overall ?? "pending") as AchievementStatus} />
          <Typography variant="body2"><strong>{row.item}</strong> {row.comments ?? ""}</Typography>
        </Stack>
      ))}
      <Button component="a" href="https://helpdesk.gvwgroup.com/Timesheet.do" target="_blank" rel="noreferrer" sx={{ alignSelf: "flex-start" }}>Helpdesk timesheet</Button>
      {shown.map((item) => (
        <Stack key={item.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <StatusIcon status={item.status ?? "pending"} />
          <Typography variant="body2">{sheetLabel(item.sheet)} · {item.values.Quarter}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}
