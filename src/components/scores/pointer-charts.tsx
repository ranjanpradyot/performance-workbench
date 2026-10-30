"use client";

import { useState } from "react";
import { Box, ButtonBase, Card, CardContent, Typography, useTheme } from "@mui/material";
import { Area, AreaChart, CartesianGrid, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMetric } from "@/domain/dashboard";
import { reporteeForeground } from "@/theme/reportee-colors";

export interface PointerQuarter {
  label: string;
  achieved: number;
  possible: number;
}

export interface PointerPerson {
  id: string;
  name: string;
  color: string;
  quarters: Array<{ label: string; achieved: number | null; possible: number | null }>;
}

const MOTION = { isAnimationActive: true, animationDuration: 1100, animationEasing: "ease-out" as const };

export function PointerCharts({ quarters, people }: { quarters: PointerQuarter[]; people: PointerPerson[] }) {
  const mode = useTheme().palette.mode;
  const tick = mode === "dark" ? "#8E9AAC" : "#5C6370";
  const grid = mode === "dark" ? "rgba(255,255,255,0.08)" : "#E7E9EE";
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" }, gap: 1.5 }}>
      <Card>
        <CardContent>
          <Typography variant="h6">Pointers by quarter</Typography>
          <Typography variant="body2" color="text.secondary">Achieved pointers against the quarter total. Not applicable quarters do not add pointers.</Typography>
          <Box sx={{ height: 280, mt: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={quarters}>
                <defs>
                  <linearGradient id="pointer-achieved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#004FCC" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#004FCC" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: tick, fontSize: 12 }} />
                <YAxis tick={{ fill: tick, fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="possible" name="Possible" stroke="#F88800" fill="transparent" strokeDasharray="5 4" {...MOTION} />
                <Area type="monotone" dataKey="achieved" name="Achieved" stroke="#004FCC" fill="url(#pointer-achieved)" strokeWidth={2.5} {...MOTION} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
      <AttainmentRadar people={people} />
    </Box>
  );
}

function AttainmentRadar({ people }: { people: PointerPerson[] }) {
  const mode = useTheme().palette.mode;
  const tick = mode === "dark" ? "#8E9AAC" : "#5C6370";
  const grid = mode === "dark" ? "rgba(255,255,255,0.16)" : "#E7E9EE";
  const peopleKey = people.map((person) => person.id).join("|");
  const [selection, setSelection] = useState<{ key: string; picked: string[] | "all" }>({ key: peopleKey, picked: "all" });
  if (selection.key !== peopleKey) setSelection({ key: peopleKey, picked: "all" });
  const picked = selection.picked === "all" ? people.map((person) => person.id) : selection.picked.filter((id) => people.some((person) => person.id === id));
  const shown = people.filter((person) => picked.includes(person.id));
  const total = totalsOf(shown);
  const ratio = total && total.possible > 0 ? Math.min(100, Math.round((total.achieved / total.possible) * 100)) : null;
  const spokes = people[0]?.quarters.map((quarter) => quarter.label) ?? [];
  const data = spokes.map((label) => {
    const point: Record<string, string | number | null> = { label };
    for (const person of shown) {
      const quarter = person.quarters.find((item) => item.label === label);
      point[person.id] = quarter ? attainment(quarter.achieved, quarter.possible) : null;
    }
    return point;
  });
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">Pointer attainment</Typography>
        <Typography variant="body2" color="text.secondary">{total ? `${formatMetric(total.achieved)} of ${formatMetric(total.possible)} decided pointers` : "No decided pointers for this selection"}{ratio != null ? ` · ${ratio}%` : ""}</Typography>
        <Box role="group" aria-label="Reportees" sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.5 }}>
          <FilterChip label="All" color="#004FCC" selected={selection.picked === "all"} onClick={() => setSelection({ key: peopleKey, picked: "all" })} />
          {people.map((person) => (
            <FilterChip
              key={person.id}
              label={person.name}
              color={person.color}
              selected={picked.includes(person.id)}
              onClick={() => {
                const next = picked.includes(person.id) ? picked.filter((id) => id !== person.id) : [...picked, person.id];
                setSelection({ key: peopleKey, picked: next.length === people.length ? "all" : next });
              }}
            />
          ))}
        </Box>
        {shown.length === 0 && <Typography color="text.secondary" sx={{ mt: 2 }}>Select a reportee to see attainment.</Typography>}
        {shown.length > 0 && (
          <Box sx={{ height: 320, mt: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data} outerRadius="72%">
                <PolarGrid stroke={grid} />
                <PolarAngleAxis dataKey="label" tick={{ fill: tick, fontSize: 12 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: tick, fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                <Tooltip content={<AttainmentTip people={shown} />} />
                {shown.map((person) => (
                  <Radar key={person.id} name={person.name} dataKey={person.id} stroke={person.color} fill={person.color} fillOpacity={0.22} strokeWidth={2} {...MOTION} />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function FilterChip({ label, color, selected, onClick }: { label: string; color: string; selected: boolean; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        px: 1.5,
        height: 32,
        borderRadius: "16px",
        border: "1px solid",
        borderColor: color,
        bgcolor: selected ? color : "transparent",
        color: selected ? reporteeForeground(color) : color,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {label}
    </ButtonBase>
  );
}

function AttainmentTip({ active, payload, label, people }: { active?: boolean; payload?: Array<{ dataKey?: string | number; value?: number | null }>; label?: string; people: PointerPerson[] }) {
  const mode = useTheme().palette.mode;
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ px: 1.25, py: 1, borderRadius: "8px", bgcolor: mode === "dark" ? "#121826" : "#fff", border: "1px solid", borderColor: mode === "dark" ? "rgba(255,255,255,0.12)" : "#E7E9EE" }}>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>{label}</Typography>
      {payload.map((item) => {
        const person = people.find((entry) => entry.id === item.dataKey);
        return (
          <Typography key={String(item.dataKey)} variant="caption" sx={{ display: "block", color: person?.color }}>
            {person?.name ?? item.dataKey}: {item.value == null ? "Not assessed" : `${item.value}%`}
          </Typography>
        );
      })}
    </Box>
  );
}

function attainment(achieved: number | null, possible: number | null): number | null {
  if (achieved == null || possible == null || possible <= 0) return null;
  return Math.round((achieved / possible) * 1000) / 10;
}

function totalsOf(people: PointerPerson[]): { achieved: number; possible: number } | null {
  let achieved = 0;
  let possible = 0;
  let any = false;
  for (const person of people) {
    for (const quarter of person.quarters) {
      if (quarter.achieved == null || quarter.possible == null) continue;
      any = true;
      achieved += quarter.achieved;
      possible += quarter.possible;
    }
  }
  return any ? { achieved, possible } : null;
}
