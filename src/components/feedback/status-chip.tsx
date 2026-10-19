import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import HourglassEmptyRoundedIcon from "@mui/icons-material/HourglassEmptyRounded";
import RemoveCircleOutlineRoundedIcon from "@mui/icons-material/RemoveCircleOutlineRounded";
import { Chip, Tooltip, type SvgIconProps } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { ComponentType } from "react";
import { statusLabel } from "@/domain/status";
import type { AchievementStatus } from "@/domain/types";

interface StatusLook {
  icon: ComponentType<SvgIconProps>;
  light: string;
  dark: string;
}

const LOOKS: Record<AchievementStatus, StatusLook> = {
  achieved: { icon: CheckCircleRoundedIcon, light: "#0E7A4D", dark: "#3FCB8E" },
  not_achieved: { icon: CancelRoundedIcon, light: "#C0392B", dark: "#FF7A6B" },
  pending: { icon: HourglassEmptyRoundedIcon, light: "#A55800", dark: "#FFA050" },
  insufficient_evidence: { icon: HelpOutlineRoundedIcon, light: "#2A6BEF", dark: "#6E9BFF" },
  not_applicable: { icon: RemoveCircleOutlineRoundedIcon, light: "#6B7280", dark: "#B7C2D1" },
  overridden: { icon: EditNoteRoundedIcon, light: "#7A3EC8", dark: "#C49BFF" },
};

export function statusColor(status: AchievementStatus, mode: "light" | "dark"): string {
  return LOOKS[status][mode];
}

export function StatusIcon({ status, size = "small", title }: { status: AchievementStatus; size?: "small" | "medium" | "inherit"; title?: string }) {
  const theme = useTheme();
  const look = LOOKS[status];
  const Icon = look.icon;
  const label = title ?? statusLabel(status);
  return (
    <Tooltip title={label}>
      <Icon fontSize={size} titleAccess={label} sx={{ color: look[theme.palette.mode], verticalAlign: "middle" }} />
    </Tooltip>
  );
}

export function StatusChip({ status, overridden = false }: { status: AchievementStatus; overridden?: boolean }) {
  const theme = useTheme();
  const look = LOOKS[status];
  const Icon = look.icon;
  const color = look[theme.palette.mode];
  const label = overridden ? `${statusLabel(status)} (override)` : statusLabel(status);
  return (
    <Chip
      size="small"
      icon={<Icon />}
      label={label}
      sx={{ fontWeight: 600, color, bgcolor: alpha(color, theme.palette.mode === "dark" ? 0.16 : 0.1), border: overridden ? `1px dashed ${color}` : "none", "& .MuiChip-icon": { color } }}
    />
  );
}
