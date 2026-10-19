"use client";

import { Box, ButtonBase } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { accentForMode, reporteeForeground } from "@/theme/reportee-colors";

export interface SegmentedItem {
  id: string;
  label: string;
  /** Selected-segment fill. Defaults to Molecule brand blue. */
  color?: string;
  badge?: number | string;
  badgeLabel?: string;
}

/** Molecule Segmented Tabs: pill track, colour-filled selected segment, optional count badge. */
export function SegmentedTabs({ items, value, onChange, ariaLabel }: { items: SegmentedItem[]; value: string; onChange: (id: string) => void; ariaLabel: string }) {
  const mode = useTheme().palette.mode;
  const dark = mode === "dark";
  return (
    <Box
      role="tablist"
      aria-label={ariaLabel}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "2px",
        p: "5px",
        maxWidth: "100%",
        bgcolor: dark ? "rgba(255,255,255,0.04)" : "#F4F5F7",
        border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "#E7E9EE"}`,
        borderRadius: "26px",
        fontFamily: "var(--font-inter), Inter, sans-serif",
      }}
    >
      {items.map((item) => {
        const selected = item.id === value;
        const base = item.color ?? "#004FCC";
        const fill = dark ? accentForMode(base, mode) : base;
        const ink = reporteeForeground(fill);
        return (
          <ButtonBase
            key={item.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: "9px",
              height: 42,
              px: "20px",
              borderRadius: "26px",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: "nowrap",
              color: selected ? ink : dark ? "#B7C2D1" : "#5C6370",
              bgcolor: selected ? fill : "transparent",
              boxShadow: selected ? `0 6px 14px ${alpha(fill, 0.28)}` : "none",
              transition: "background-color 220ms, color 220ms, box-shadow 220ms",
              "&:hover": selected ? {} : { bgcolor: dark ? "rgba(255,255,255,0.08)" : "#E8ECF4", color: dark ? "#FFFFFF" : "#0E1015" },
              "&.Mui-focusVisible": { outline: "2px solid #2A6BEF", outlineOffset: 2 },
            }}
          >
            <Box component="span" sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: selected ? ink : fill, opacity: selected ? 0.9 : 1 }} />
            {item.label}
            {item.badge != null && (
              <Box
                component="span"
                aria-label={item.badgeLabel}
                sx={{
                  minWidth: 22,
                  height: 22,
                  px: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "26px",
                  fontSize: 12,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  bgcolor: selected ? alpha(ink, 0.22) : alpha(fill, 0.12),
                  color: selected ? ink : dark ? fill : base,
                }}
              >
                {item.badge}
              </Box>
            )}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
