"use client";

import SearchIcon from "@mui/icons-material/Search";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { Alert, AppBar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Snackbar, Toolbar, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useThemeMode } from "@/app/providers";
import { useWorkbench } from "@/state/workbench-context";
import { FilterBar } from "./filter-bar";

const NAV_KEY = "pms-workbench-nav";
const NAV = [
  { href: "/", label: "Dashboard", icon: DashboardOutlinedIcon },
  { href: "/reportees", label: "Reportees", icon: GroupsOutlinedIcon },
  { href: "/quarters", label: "Quarters", icon: CalendarMonthOutlinedIcon },
  { href: "/import", label: "Import", icon: FileUploadOutlinedIcon },
  { href: "/settings", label: "Settings", icon: SettingsOutlinedIcon },
];

const NAV_TOKENS = {
  panel: "#0A1122",
  panelDeep: "#070D1B",
  border: "rgba(140,170,255,0.14)",
  selectedBorder: "rgba(140,170,255,0.16)",
  selectedSurface: "rgba(110,155,255,0.1)",
  surfaceHover: "rgba(255,255,255,0.08)",
  text: "#C7D2E6",
  textMuted: "#7C8AA5",
  textActive: "#FFFFFF",
  interactive: "#6E9BFF",
  interactiveHover: "#9DBCFF",
  badgeSelected: "#1554D6",
  focus: "#2A6BEF",
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dataset, message, clearMessage, saved, loading, error } = useWorkbench();
  const { mode, setMode } = useThemeMode();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const rail = desktop && collapsed;
  const drawerWidth = rail ? 76 : 252;
  const results = useMemo(() => search(dataset, query), [dataset, query]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.localStorage.getItem(NAV_KEY) === "collapsed") setCollapsed(true);
  }, []);

  function toggleNav() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(NAV_KEY, next ? "collapsed" : "expanded");
      return next;
    });
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Box sx={{ width: desktop ? drawerWidth : 0, flexShrink: 0, alignSelf: "flex-start", position: "sticky", top: 0, height: "100vh", overflow: "visible", zIndex: 1200, transition: theme.transitions.create("width") }}>
      <Drawer variant={desktop ? "permanent" : "temporary"} open={desktop || navOpen} onClose={() => setNavOpen(false)} sx={{ width: "100%", height: "100%", "& .MuiDrawer-paper": { width: drawerWidth, height: "100vh", boxSizing: "border-box", borderRight: `1px solid ${NAV_TOKENS.border}`, overflowX: "hidden", overflowY: "auto", position: "sticky", top: 0, transition: theme.transitions.create("width"), color: NAV_TOKENS.text, fontFamily: "var(--font-inter), Inter, sans-serif", background: `linear-gradient(180deg, ${NAV_TOKENS.panel}, ${NAV_TOKENS.panelDeep})` } }}>
        <Toolbar sx={{ gap: 1, px: rail ? 1 : 2.75, py: 2.5, height: "auto", alignItems: "center", justifyContent: rail ? "center" : "flex-start", borderBottom: `1px solid ${NAV_TOKENS.border}` }}>
          {rail ? (
            <Box component="img" src="/brand/nalashaa-mark.svg" alt="Nalashaa" sx={{ height: 22, width: "auto" }} />
          ) : (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box component="img" src="/brand/nalashaa-logo-dark.svg" alt="Nalashaa" sx={{ display: "block", height: 22, width: "auto" }} />
              <Typography sx={{ mt: 1.25, color: NAV_TOKENS.textActive, fontFamily: "var(--font-jakarta), sans-serif", fontWeight: 700, fontSize: 14, lineHeight: 1.3, whiteSpace: "nowrap" }}>{"Pradyot's PMS Workbench"}</Typography>
            </Box>
          )}
        </Toolbar>
        {!rail && (
          <Typography component="p" sx={{ px: 2.75, pt: 2.5, pb: 1.25, color: NAV_TOKENS.textMuted, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", lineHeight: 1.5 }}>
            Workspace
          </Typography>
        )}
        <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: "6px", px: rail ? 1.5 : 1.75, pt: rail ? 2.5 : 0 }}>
          {NAV.map((item) => {
            const current = pathname === item.href;
            return (
              <Tooltip key={item.href} title={rail ? item.label : ""} placement="right">
                <ListItemButton
                  component={Link}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={current ? "page" : undefined}
                  selected={current}
                  onClick={() => setNavOpen(false)}
                  sx={{
                    position: "relative",
                    m: 0,
                    minHeight: 40,
                    gap: "10px",
                    borderRadius: "8px",
                    py: "6px",
                    pl: rail ? 0 : "14px",
                    pr: rail ? 0 : 1.5,
                    justifyContent: rail ? "center" : "flex-start",
                    color: NAV_TOKENS.text,
                    fontSize: 14,
                    fontWeight: 600,
                    transition: "background-color 150ms, color 150ms",
                    "&::before": { content: '""', position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: "3px", backgroundColor: "transparent" },
                    "&:hover": { backgroundColor: NAV_TOKENS.selectedSurface },
                    "&.Mui-selected, &.Mui-selected:hover": { backgroundColor: NAV_TOKENS.selectedSurface, color: NAV_TOKENS.textActive },
                    "&.Mui-selected::before": { backgroundColor: NAV_TOKENS.interactive },
                    "&.Mui-focusVisible": { outline: `2px solid ${NAV_TOKENS.focus}`, outlineOffset: 2, backgroundColor: NAV_TOKENS.selectedSurface },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 0, width: 28, height: 28, borderRadius: "8px", display: "grid", placeItems: "center", color: current ? NAV_TOKENS.textActive : NAV_TOKENS.text, bgcolor: current ? NAV_TOKENS.badgeSelected : NAV_TOKENS.surfaceHover, transition: "background-color 150ms" }}>
                    <item.icon sx={{ fontSize: 15 }} />
                  </ListItemIcon>
                  {!rail && <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontFamily: "inherit", fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: "inherit" } } }} sx={{ my: 0 }} />}
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
      </Drawer>
      <IconButton aria-label={rail ? "Expand navigation" : "Collapse navigation"} onClick={toggleNav} sx={{ position: "absolute", top: "50%", right: -18, transform: "translateY(-50%)", zIndex: 1301, color: NAV_TOKENS.interactive, bgcolor: NAV_TOKENS.panel, border: "1px solid rgba(255,255,255,0.28)", width: 36, height: 36, display: { xs: "none", md: "inline-flex" }, "& svg": { fontSize: 18 }, "&:hover": { bgcolor: NAV_TOKENS.panel, color: NAV_TOKENS.interactiveHover, borderColor: NAV_TOKENS.interactive }, "&.Mui-focusVisible": { outline: `2px solid ${NAV_TOKENS.focus}`, outlineOffset: 2 } }}>
        {rail ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </IconButton>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Box sx={{ height: 3, bgcolor: "primary.main" }} />
          <Toolbar sx={{ gap: 2 }}>
            <IconButton aria-label="Open navigation" onClick={() => setNavOpen(true)} sx={{ display: { md: "none" } }}>
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
              <SearchIcon fontSize="small" />
              <input
                aria-label="Search reportees, tickets, OKRs, and evidence"
                value={query}
                placeholder="Search people, tickets, OKRs, evidence"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && results[0]) router.push(results[0].href);
                  if (event.key === "Escape") setSearchOpen(false);
                }}
                style={{ border: 0, outline: "none", background: "transparent", width: "100%", font: "inherit" }}
              />
            </Box>
            <Typography variant="caption" color={saved ? "success.main" : "warning.main"}>{loading ? "Loading" : saved ? "Saved locally" : "Unsaved"}</Typography>
            <IconButton aria-label={mode === "light" ? "Switch to dark theme" : "Switch to light theme"} onClick={() => setMode(mode === "light" ? "dark" : "light")} sx={mode === "light" ? { color: "primary.main", bgcolor: "rgba(0,79,204,0.08)", "&:hover": { bgcolor: "rgba(0,79,204,0.16)" } } : { color: "#F88800", bgcolor: "rgba(248,136,0,0.14)", "&:hover": { bgcolor: "rgba(248,136,0,0.24)" } }}>
              {mode === "light" ? <DarkModeOutlinedIcon /> : <LightModeOutlinedIcon />}
            </IconButton>
          </Toolbar>
          {pathname === "/" && <FilterBar />}
        </AppBar>
        {searchOpen && query.trim() && (
          <Box sx={{ px: 3, py: 1, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
            {results.length === 0 && <Typography variant="body2">No matches.</Typography>}
            {results.slice(0, 8).map((result) => (
              <ListItemButton key={result.href + result.label} component={Link} href={result.href} onClick={() => setSearchOpen(false)}>
                <ListItemText primary={result.label} secondary={result.detail} />
              </ListItemButton>
            ))}
          </Box>
        )}
        <Box component="main" sx={{ p: { xs: 2, md: 3 } }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {children}
        </Box>
      </Box>
      <Snackbar open={Boolean(message)} autoHideDuration={4000} onClose={clearMessage}>
        <Alert severity={message?.severity ?? "success"} onClose={clearMessage}>{message?.text}</Alert>
      </Snackbar>
    </Box>
  );
}

function search(dataset: ReturnType<typeof useWorkbench>["dataset"], query: string): Array<{ href: string; label: string; detail: string }> {
  if (!dataset || query.trim().length < 2) return [];
  const needle = query.trim().toLowerCase();
  const hits: Array<{ href: string; label: string; detail: string }> = [];
  for (const person of dataset.reportees) {
    if (`${person.fullName} ${person.employeeId ?? ""} ${person.role ?? ""}`.toLowerCase().includes(needle)) {
      hits.push({ href: `/reportees/${person.id}`, label: person.fullName, detail: person.role ?? "Reportee" });
    }
  }
  for (const ticket of dataset.tickets) {
    if (`${ticket.ticketNo} ${ticket.description ?? ""}`.toLowerCase().includes(needle)) {
      hits.push({ href: `/reportees/${ticket.reporteeId}`, label: ticket.ticketNo, detail: ticket.description ?? "Ticket" });
    }
  }
  for (const entry of dataset.okrChecklistEntries) {
    if (`${entry.okrs} ${entry.deliverableExpected ?? ""}`.toLowerCase().includes(needle)) {
      hits.push({ href: `/reportees/${entry.reporteeId}`, label: entry.kpiAffected || "OKR", detail: entry.okrs.slice(0, 120) });
    }
  }
  for (const item of dataset.learningEvidence) {
    if (`${item.focusArea ?? ""} ${item.comments ?? ""}`.toLowerCase().includes(needle)) {
      hits.push({ href: `/reportees/${item.reporteeId}`, label: item.focusArea ?? "Learning", detail: item.kpi ?? "Learning evidence" });
    }
  }
  return hits.slice(0, 20);
}
