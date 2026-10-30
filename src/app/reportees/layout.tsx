"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SegmentedTabs } from "@/components/molecule/segmented-tabs";
import { useWorkbench } from "@/state/workbench-context";

const ARCHIVED_COLOR = "#6B7280";

export default function ReporteesLayout({ children }: { children: ReactNode }) {
  const { dataset } = useWorkbench();
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  if (!dataset) return <Typography>Loading reportees…</Typography>;

  const current = dataset.reportees.find((person) => person.id === params.id);
  const archivedCount = dataset.reportees.filter((person) => person.status === "archived").length;
  const visible = dataset.reportees.filter((person) => person.status !== "archived" || showArchived || person.id === current?.id);
  const pendingFor = (id: string) => dataset.kpiAssessments.filter((row) => row.reporteeId === id && (row.status === "pending" || row.status === "insufficient_evidence")).length;

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Reportees</Typography>
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
    </Stack>
  );
}
