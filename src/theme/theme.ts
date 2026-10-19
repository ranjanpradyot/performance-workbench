"use client";

import { createTheme } from "@mui/material/styles";

const display = 'var(--font-jakarta), "Plus Jakarta Sans", sans-serif';
const body = 'var(--font-inter), Inter, sans-serif';

export function buildTheme(mode: "light" | "dark") {
  const dark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: { main: "#004FCC", dark: "#0043B3", light: "#6E9BFF", contrastText: "#FFFFFF" },
      secondary: { main: "#F88800", dark: "#A55800", light: "#FFA050", contrastText: "#0E1015" },
      background: {
        default: dark ? "#0A0C14" : "#F4F5F7",
        paper: dark ? "#11141D" : "#FFFFFF",
      },
      text: {
        primary: dark ? "#FFFFFF" : "#0E1015",
        secondary: dark ? "#B7C2D1" : "#5C6370",
      },
      divider: dark ? "#4A5263" : "#E7E9EE",
      warning: { main: "#F88800" },
      success: { main: "#0E7A4D" },
      error: { main: "#C0392B" },
      info: { main: "#2A6BEF" },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: body,
      h4: { fontFamily: display, fontWeight: 700, fontSize: "2rem", letterSpacing: "-0.03em" },
      h5: { fontFamily: display, fontWeight: 700, letterSpacing: "-0.02em" },
      h6: { fontFamily: display, fontWeight: 700, letterSpacing: "-0.01em" },
      subtitle1: { fontFamily: display, fontWeight: 700 },
      subtitle2: { fontWeight: 600 },
      button: { fontFamily: body, fontWeight: 600, textTransform: "none" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: { body: { fontFamily: body } },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            boxShadow: dark ? "none" : "0px 7px 16px rgba(156,156,156,0.1), 0px 29px 29px rgba(156,156,156,0.09)",
            border: "1px solid",
            borderColor: dark ? "rgba(255,255,255,0.1)" : "#DDE2E9",
            backgroundImage: "none",
          },
        },
      },
      MuiCardContent: {
        styleOverrides: { root: { padding: 20, "&:last-child": { paddingBottom: 20 } } },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 26, textTransform: "none", fontWeight: 600, minHeight: 40 },
          text: dark ? { color: "#6E9BFF" } : {},
          outlined: dark ? { color: "#6E9BFF", borderColor: "#6E9BFF" } : {},
        },
        defaultProps: { disableElevation: true },
      },
      MuiIconButton: {
        styleOverrides: { root: { borderRadius: "50%" } },
      },
      MuiOutlinedInput: {
        styleOverrides: { root: { borderRadius: 10 } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginInline: 8,
            marginBlock: 2,
          },
        },
      },
    },
  });
}
