"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SegmentedTabs } from "@/components/molecule/segmented-tabs";
import { ReporteeDialog } from "@/components/reportees/reportee-dialog";
import { setReporteeStatus } from "@/domain/mutations";
import type { Reportee } from "@/domain/types";
import { useWorkbench } from "@/state/workbench-context";

const ARCHIVED_COLOR = "#6B7280";

export default function ReporteesLayout({ children }: { children: ReactNode }) {
  const { dataset, commit } = useWorkbench();
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; person: Reportee | null }>({ open: false, person: null });
  if (!dataset) return <Typography>Loading reportees…</Typography>;

  const current = dataset.reportees.find((person) => person.id === params.id);
  const archivedCount = dataset.reportees.filter((person) => person.status === "archived").length;
  const visible = dataset.reportees.filter((person) => person.status !== "archived" || showArchived || person.id === current?.id);
  const pendingFor = (id: string) => dataset.kpiAssessments.filter((row) => row.reporteeId === id && (row.status === "pending" || row.status === "insufficient_evidence")).length;

  function toggleArchive(person: Reportee) {
    const nextStatus = person.status === "archived" ? "active" : "archived";
    const reason = nextStatus === "archived" ? "Archived from the reportee tabs. Historical appraisals stay linked to the internal id." : "Restored to the active reportees.";
    if (nextStatus === "archived" && !window.confirm(`Archive ${person.fullName}? Historical quarters, tickets, and evidence stay in the workbook.`)) return;
    void commit(setReporteeStatus(dataset!, person.id, nextStatus, reason), nextStatus === "archived" ? "Archive reportee" : "Restore reportee");
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
        <Typography variant="h4">Reportees</Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          {current && <Button variant="outlined" onClick={() => setDialog({ open: true, person: current })}>Edit details</Button>}
          {current && <Button onClick={() => toggleArchive(current)}>{current.status === "archived" ? "Restore" : "Archive"}</Button>}
          <Button variant="contained" onClick={() => setDialog({ open: true, person: null })}>Add reportee</Button>
        </Stack>
      </Stack>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <SegmentedTabs
          ariaLabel="Reportees"
          value={current?.id ?? ""}
          onChange={(id) => router.push(`/reportees/${id}`)}
          items={visible.map((person) => {
            const pending = pendingFor(person.id);
            return {
              id: person.id,
              label: person.status === "archived" ? `${person.fullName} (archived)` : person.fullName,
              color: person.status === "archived" ? ARCHIVED_COLOR : person.themeColor,
              badge: pending || undefined,
              badgeLabel: pending ? `${pending} KPIs not assessed` : undefined,
            };
          })}
        />
        {archivedCount > 0 && (
          <Button size="small" onClick={() => setShowArchived((value) => !value)}>{showArchived ? "Hide archived" : `Show archived (${archivedCount})`}</Button>
        )}
      </Box>
      {children}
      <ReporteeDialog
        open={dialog.open}
        person={dialog.person}
        onClose={() => setDialog({ open: false, person: null })}
        onSaved={(id) => { if (id) router.push(`/reportees/${id}`); }}
      />
    </Stack>
  );
}
