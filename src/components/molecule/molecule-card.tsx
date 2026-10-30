"use client";

import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box, ButtonBase, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { accentForMode } from "@/theme/reportee-colors";

const LIGHT = {
  surface: "#FFFFFF",
  border: "#DDE2E9",
  tile: "#F7F8FA",
  title: "#0E1015",
  body: "#5C6370",
  shadow: "0px 7px 16px rgba(156,156,156,0.1), 0px 29px 29px rgba(156,156,156,0.09)",
  shadowHover: "0px 11px 26px rgba(156,156,156,0.115), 0px 46px 46px rgba(156,156,156,0.104)",
};

const DARK = {
  surface: "#11141D",
  border: "rgba(255,255,255,0.1)",
  tile: "rgba(255,255,255,0.04)",
  title: "#FFFFFF",
  body: "#8E9AAC",
  shadow: "none",
  shadowHover: "0 0 0 1px rgba(110,155,255,0.4)",
};

export interface MoleculeCardProps {
  /** Brand or reportee colour. Drives the icon, the "New" wash, the accent bar, and the action link. */
  accent?: string;
  icon?: ReactNode;
  title: ReactNode;
  /** Large figure shown under the title, for metric cards. */
  value?: ReactNode;
  children?: ReactNode;
  action?: string;
  onClick?: () => void;
  /** Molecule "New" card: a light wash of the accent fades into the surface. */
  wash?: boolean;
  /** Molecule "On dark" card: a short accent bar under the title. */
  bar?: boolean;
  headerEnd?: ReactNode;
  ariaLabel?: string;
  /** Shorter metric tile. Used by the dashboard so five tiles fit on one row. */
  compact?: boolean;
}

export function MoleculeCard({ accent = "#004FCC", icon, title, value, children, action, onClick, wash = false, bar = false, headerEnd, ariaLabel, compact = false }: MoleculeCardProps) {
  const theme = useTheme();
  const mode = theme.palette.mode;
  const tokens = mode === "dark" ? DARK : LIGHT;
  const tone = accentForMode(accent, mode);
  const background = wash ? `linear-gradient(180deg, ${alpha(tone, mode === "dark" ? 0.14 : 0.09)} 0%, ${tokens.surface} 62%)` : tokens.surface;
  const content = (
    <>
      {(icon || headerEnd) && (
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: compact ? 1 : 2 }}>
          {icon ? (
            <Box sx={{ width: compact ? 32 : 48, height: compact ? 32 : 48, borderRadius: compact ? "8px" : "12px", display: "grid", placeItems: "center", bgcolor: tokens.tile, border: `1px solid ${tokens.border}`, color: tone, "& svg": { fontSize: compact ? 18 : 24 } }}>{icon}</Box>
          ) : <span />}
          {headerEnd}
        </Box>
      )}
      <Typography component="h3" sx={{ m: 0, fontFamily: "var(--font-jakarta), sans-serif", fontWeight: 700, fontSize: compact ? 13 : 18, lineHeight: 1.25, color: tokens.title }}>{title}</Typography>
      {bar && <Box sx={{ width: 40, height: 4, borderRadius: "2px", bgcolor: tone, mt: 1.25 }} />}
      {value != null && <Typography sx={{ mt: compact ? 0.5 : 1, fontFamily: "var(--font-jakarta), sans-serif", fontWeight: 700, fontSize: compact ? 20 : 28, lineHeight: 1.2, color: tokens.title }}>{value}</Typography>}
      {children != null && <Box sx={{ mt: compact ? 0.5 : 1, fontSize: compact ? 12 : 14, lineHeight: compact ? 1.35 : 1.55, color: tokens.body }}>{children}</Box>}
      {action && (
        <Box component="span" sx={{ mt: compact ? 1 : 2.5, display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: compact ? 12 : 14, fontWeight: 500, color: mode === "dark" ? "#6E9BFF" : "#004FCC" }}>
          {action}
          <ChevronRightIcon sx={{ fontSize: 18 }} />
        </Box>
      )}
    </>
  );
  const frame = {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    textAlign: "left",
    width: "100%",
    height: "100%",
    p: compact ? 1.25 : 2.5,
    borderRadius: "14px",
    border: `1px solid ${tokens.border}`,
    background,
    boxShadow: tokens.shadow,
    color: tokens.body,
    fontFamily: "var(--font-inter), Inter, sans-serif",
    transition: "transform 150ms ease, box-shadow 150ms ease",
  } as const;
  if (!onClick) return <Box sx={frame} aria-label={ariaLabel}>{content}</Box>;
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={ariaLabel}
      sx={{
        ...frame,
        justifyContent: "flex-start",
        "&:hover": { transform: "translateY(-2px)", boxShadow: tokens.shadowHover },
        "&.Mui-focusVisible": { outline: "2px solid #2A6BEF", outlineOffset: 2 },
      }}
    >
      {content}
    </ButtonBase>
  );
}
