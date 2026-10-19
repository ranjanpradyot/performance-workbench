import { alpha } from "@mui/material/styles";

/** Molecule identity colors. Brand blue, accent orange, and the panel navy stay distinct. */
export const REPORTEE_COLORS = ["#004FCC", "#F88800", "#0A2A5C", "#0043B3", "#2A6BEF", "#003A9C"] as const;

const LEGACY_COLORS: Record<string, string> = {
  "#1F4E79": "#004FCC",
  "#4F46E5": "#004FCC",
  "#0F6E56": "#F88800",
  "#E11D48": "#F88800",
  "#8A4B08": "#0A2A5C",
  "#F97316": "#0A2A5C",
};

/** Dark blues and the orange text tone disappear on the dark ground, so they lift to Molecule's light tints. */
const DARK_ACCENTS: Record<string, string> = {
  "#004FCC": "#6E9BFF",
  "#0043B3": "#6E9BFF",
  "#2A6BEF": "#6E9BFF",
  "#003A9C": "#9BB9FF",
  "#0A2A5C": "#9BB9FF",
  "#A55800": "#FFA050",
};

export function reporteeColor(index: number): string {
  return REPORTEE_COLORS[index % REPORTEE_COLORS.length];
}

export function vibrantThemeColor(color: string): string {
  return LEGACY_COLORS[color.toUpperCase()] ?? color;
}

export function accentForMode(color: string, mode: "light" | "dark"): string {
  return mode === "dark" ? DARK_ACCENTS[color.toUpperCase()] ?? color : color;
}

/** Light wash of a strip color for the tile behind it. */
export function tileTint(color: string, mode: "light" | "dark"): string {
  return alpha(accentForMode(color, mode), mode === "dark" ? 0.12 : 0.08);
}

/** Tint laid over the paper color, so a tile stays lighter than the page instead of picking up the grey ground. */
export function tileSx(color: string, mode: "light" | "dark") {
  const tint = tileTint(color, mode);
  return { bgcolor: "background.paper", backgroundImage: `linear-gradient(${tint}, ${tint})` };
}

/** Ink on orange and other light fills. White on brand blue and navy. */
export function reporteeForeground(color: string): string {
  const hex = color.replace("#", "");
  if (hex.length < 6) return "#FFFFFF";
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.55 ? "#0E1015" : "#FFFFFF";
}
