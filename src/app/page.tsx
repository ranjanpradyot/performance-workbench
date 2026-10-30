"use client";

import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import { Box, Card, CardActionArea, CardContent, Stack, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { statusColor, StatusIcon } from "@/components/feedback/status-chip";
import { MoleculeCard } from "@/components/molecule/molecule-card";
import { PointerCharts } from "@/components/scores/pointer-charts";
import { ScoreInfographic } from "@/components/scores/score-infographic";
import { buildDashboard, formatMetric, quarterScores } from "@/domain/dashboard";
import type { AchievementStatus } from "@/domain/types";
import { useWorkbench } from "@/state/workbench-context";

const CARD_ACCENTS = ["#004FCC", "#F88800", "#0A2A5C", "#2A6BEF", "#0043B3", "#A55800"];

export default function DashboardPage() {
  const { dataset, loading, filters, setFilters } = useWorkbench();
  const router = useRouter();
  if (loading || !dataset) return <Typography>Loading the local workbench…</Typography>;
  const model = buildDashboard(dataset, filters);
  const scopeQuarterIds = dataset.quarters
    .filter((quarter) => (filters.quarterId === "all" || quarter.id === filters.quarterId) && (filters.year === "all" || String(quarter.year) === filters.year))
    .map((quarter) => quarter.id);
  const scoreRows = model.comparisons.map((person) => ({ person, scores: quarterScores(dataset, person.id, scopeQuarterIds) }));
  const scoreQuarters = [...dataset.quarters]
    .sort((a, b) => a.year - b.year || a.quarterNumber - b.quarterNumber)
    .filter((quarter) => scoreRows.some((row) => row.scores.some((score) => score.quarterId === quarter.id)));
  return (
    <Stack spacing={2.5}>
      <Typography variant="h4">Appraisal desk</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(5, 1fr)" }, gap: 1 }}>
        <MetricCard accent={CARD_ACCENTS[0]} icon={<GroupsOutlinedIcon />} title="Active reportees" value={String(model.activeReportees)} detail="People with an active profile" onClick={() => router.push("/reportees")} />
        <MetricCard accent={CARD_ACCENTS[2]} icon={<InsightsOutlinedIcon />} title="KPI points" value={formatMetric(model.kpiPoints)} detail={model.kpiPossible == null ? "Not assessed" : `of ${formatMetric(model.kpiPossible)} in view`} onClick={() => setFilters({ status: "achieved" })} />
        <MetricCard accent={CARD_ACCENTS[3]} icon={<ChecklistOutlinedIcon />} title="OKR checklist" value={formatMetric(model.okrAchieved)} detail={model.okrPossible == null ? "Not assessed" : `of ${formatMetric(model.okrPossible)} line weight`} />
        <MetricCard status="achieved" title="Achieved KPIs" value={String(model.kpiAchieved)} detail="Yes awards the quarter weight" onClick={() => setFilters({ status: "achieved" })} />
        <MetricCard status="not_achieved" title="Not achieved" value={String(model.kpiNotAchieved)} detail="Recorded No. This is not the same as missing." onClick={() => setFilters({ status: "not_achieved" })} />
        <MetricCard status="pending" title="Not assessed" value={String(model.kpiPending)} detail="Pending or not yet scored" onClick={() => setFilters({ status: "pending" })} />
        <MetricCard status="not_applicable" title="Not applicable" value={String(model.kpiNotApplicable)} detail="Explicitly out of scope" onClick={() => setFilters({ status: "not_applicable" })} />
        <MetricCard accent={CARD_ACCENTS[4]} icon={<SchoolOutlinedIcon />} title="Learning achieved" value={`${model.learningAchieved}/${model.learningTotal || "—"}`} detail={`${model.learningPending} not assessed`} />
        <MetricCard accent={CARD_ACCENTS[5]} icon={<ConfirmationNumberOutlinedIcon />} title="Closed tickets" value={formatMetric(model.closedTickets, 0)} detail={model.totalTickets == null ? "No tickets in this view" : `${formatMetric(model.openTickets, 0)} open of ${formatMetric(model.totalTickets, 0)}`} />
      </Box>
      <ScoreInfographic quarters={scoreQuarters} rows={scoreRows} onOpen={(id) => router.push(`/reportees/${id}`)} />
      <PointerCharts
        quarters={scoreQuarters.map((quarter) => {
          const scores = scoreRows.map((row) => row.scores.find((score) => score.quarterId === quarter.id)).filter((score) => score != null);
          return {
            label: quarter.label,
            achieved: scores.reduce((sum, score) => sum + (score.achieved ?? 0), 0),
            possible: scores.reduce((sum, score) => sum + (score.possible ?? 0), 0),
          };
        })}
        people={scoreRows.map(({ person, scores }) => ({
          id: person.id,
          name: person.name,
          color: person.color,
          quarters: scoreQuarters.map((quarter) => {
            const score = scores.find((item) => item.quarterId === quarter.id);
            return { label: quarter.label, achieved: score?.achieved ?? null, possible: score?.possible ?? null };
          }),
        }))}
      />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" }, gap: 1.5 }}>
        <Card>
          <CardContent>
            <Typography variant="h6">Closed tickets by quarter</Typography>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={model.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="closed" name="Closed" fill="#004FCC" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={1100} animationEasing="ease-out" />
                  <Bar dataKey="target" name="Target" fill="#F88800" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={1100} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6">Needs attention</Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {model.attention.length === 0 && <Typography color="text.secondary">Nothing in the current filter needs a follow-up.</Typography>}
              {model.attention.slice(0, 8).map((item) => (
                <CardActionArea key={item.reason + item.reporteeId} onClick={() => router.push(`/reportees/${item.reporteeId}`)}>
                  <Box sx={{ px: 1, py: 0.5, display: "flex", gap: 1, alignItems: "flex-start" }}>
                    <StatusIcon status={item.tone === "error" ? "not_achieved" : "pending"} />
                    <Box>
                      <Typography variant="subtitle2">{item.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.reason}</Typography>
                    </Box>
                  </Box>
                </CardActionArea>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}

function MetricCard({ accent, status, icon, title, value, detail, onClick }: { accent?: string; status?: AchievementStatus; icon?: ReactNode; title: string; value: string; detail: string; onClick?: () => void }) {
  const mode = useTheme().palette.mode;
  const tone = status ? statusColor(status, mode) : accent ?? "#004FCC";
  return (
    <MoleculeCard
      compact
      accent={tone}
      wash
      icon={status ? <StatusIcon status={status} /> : icon}
      title={title}
      value={value}
      onClick={onClick}
    >
      {detail}
    </MoleculeCard>
  );
}
