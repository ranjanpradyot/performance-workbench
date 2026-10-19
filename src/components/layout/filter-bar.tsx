"use client";

import { Box, FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import type { ReactNode } from "react";
import { useWorkbench } from "@/state/workbench-context";

export function FilterBar() {
  const { dataset, filters, setFilters } = useWorkbench();
  if (!dataset) return null;
  const categories = [...new Set(dataset.kpiDefinitions.map((item) => item.category))];
  return (
    <Box sx={{ display: "flex", gap: 1.5, px: 2, pb: 1.5, flexWrap: "wrap" }}>
      <SelectField label="Year" value={filters.year} onChange={(year) => setFilters({ year })} options={[["all", "All years"], ...dataset.appraisalYears.map((year) => [String(year.year), year.label] as [string, string])]} />
      <SelectField label="Quarter" value={filters.quarterId} onChange={(quarterId) => setFilters({ quarterId })} options={[["all", "All quarters"], ...dataset.quarters.map((quarter) => [quarter.id, quarter.label] as [string, string])]} />
      <SelectField label="Reportee" value={filters.reporteeId} onChange={(reporteeId) => setFilters({ reporteeId })} options={[["all", "All reportees"], ...dataset.reportees.map((person) => [person.id, person.fullName] as [string, string])]} />
      <SelectField label="KPI" value={filters.category} onChange={(category) => setFilters({ category })} options={[["all", "All KPIs"], ...categories.map((category) => [category, category] as [string, string])]} />
      <SelectField label="Status" value={filters.status} onChange={(status) => setFilters({ status })} options={STATUS_OPTIONS} />
      <SelectField label="Directory" value={filters.directory} onChange={(directory) => setFilters({ directory: directory as "active" | "archived" | "all" })} options={DIRECTORY_OPTIONS} />
    </Box>
  );
}

export const STATUS_OPTIONS: Array<[string, string]> = [["all", "All statuses"], ["achieved", "Achieved"], ["not_achieved", "Not achieved"], ["pending", "Not assessed"], ["not_applicable", "Not applicable"], ["insufficient_evidence", "Insufficient evidence"], ["overridden", "Overridden"]];

export const DIRECTORY_OPTIONS: Array<[string, string]> = [["active", "Active"], ["archived", "Archived"], ["all", "Active and archived"]];

/** Filter row that belongs to one page. It does not change the dashboard filters. */
export function PageFilters({ children }: { children: ReactNode }) {
  return <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>{children}</Box>;
}

export function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  const labelId = `${label.replace(/\s+/g, "-").toLowerCase()}-filter`;
  return (
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select labelId={labelId} label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([id, text]) => (
          <MenuItem key={id} value={id}>{text}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
