"use client";

import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { StatusChip, StatusIcon } from "@/components/feedback/status-chip";
import { MoleculeCard } from "@/components/molecule/molecule-card";
import { formatMetric, type QuarterScore } from "@/domain/dashboard";
import type { AchievementStatus } from "@/domain/types";

const LEGEND: AchievementStatus[] = ["achieved", "not_achieved", "pending", "insufficient_evidence", "not_applicable", "overridden"];

export function scoreText(score: Pick<QuarterScore, "achieved" | "possible">): string {
  if (score.possible == null) return "Not scored";
  return `${formatMetric(score.achieved)} / ${formatMetric(score.possible)}`;
}

export function StatusLegend() {
  return (
    <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
      {LEGEND.map((status) => <StatusChip key={status} status={status} />)}
    </Stack>
  );
}

export function QuarterScoreCell({ score }: { score: QuarterScore | undefined }) {
  if (!score) return <Typography variant="body2" color="text.secondary">—</Typography>;
  return (
    <Box>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
        <StatusIcon status={score.status} title={`${score.label}: ${scoreText(score)}`} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{scoreText(score)}</Typography>
      </Stack>
      {score.unassessed > 0 && <Typography variant="caption" color="text.secondary">{formatMetric(score.unassessed)} not assessed</Typography>}
    </Box>
  );
}

export function QuarterScoreCard({ score, color, onKpiClick }: { score: QuarterScore; color: string; onKpiClick?: (assessmentId: string) => void }) {
  const mode = useTheme().palette.mode;
  return (
    <MoleculeCard accent={color} wash bar icon={<StatusIcon status={score.status} />} headerEnd={<StatusChip status={score.status} />} title={score.label} value={scoreText(score)}>
        <Typography variant="body2" sx={{ color: "inherit", mb: 1.5 }}>KPI points this quarter</Typography>
        <Stack spacing={0.75} sx={{ color: mode === "dark" ? "#FFFFFF" : "#0E1015" }}>
          {score.kpis.map((kpi) => {
            const open = Boolean(onKpiClick && kpi.linked);
            return (
            <Box key={kpi.id}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <StatusIcon status={kpi.overridden ? "overridden" : kpi.status} title={kpi.overridden ? `Override: ${kpi.status.replace("_", " ")}` : undefined} />
                <Typography variant="body2" component={open ? "button" : "p"} onClick={open ? () => onKpiClick?.(kpi.id) : undefined} sx={{ flex: 1, m: 0, p: 0, border: 0, bgcolor: "transparent", color: open ? (mode === "dark" ? "#6E9BFF" : "#004FCC") : "inherit", font: "inherit", fontWeight: open ? 500 : 400, textAlign: "left", cursor: open ? "pointer" : "default" }}>{kpi.name}</Typography>
                <Typography variant="body2" color="text.secondary">{kpi.weight == null ? "—" : `${formatMetric(kpi.points)} / ${formatMetric(kpi.weight)}`}</Typography>
              </Box>
              {kpi.points == null && kpi.status !== "not_applicable" && kpi.actual && <Typography variant="caption" color="text.secondary" sx={{ display: "block", pl: 4 }}>{kpi.actual}</Typography>}
            </Box>
            );
          })}
        </Stack>
    </MoleculeCard>
  );
}
