import { useColorScheme } from "react-native";

// Mobile twin of apps/web/app/globals.css. Same hex values, same naming.
// Every screen's StyleSheet should pull from here so the palette is one
// file to swap. The light/dark variants mirror the @media-prefers
// blocks in CSS — wire them via useThemeColors().

export const lightColors = {
  paper: "#faf8f2",
  paper2: "#ffffff",
  paperSunk: "#f3eee0",

  ink: "#0b2e3f",
  ink2: "#324a59",
  inkMute: "#6c7d88",
  inkFaint: "#a7b2b9",

  brand: "#0b3d59",
  brandStrong: "#062a3e",
  brandSoft: "#d6e8f2",
  brandLink: "#1b6b96",

  go: "#0fb89a",
  goStrong: "#0a8a73",
  goSoft: "#d5f2ec",
  goInk: "#044a3e",

  maybe: "#d88b3d",
  maybeSoft: "#fbe9d2",
  maybeInk: "#5b3a18",

  noGo: "#7e8a91",
  noGoSoft: "#e7eaec",

  hazard: "#c0473f",
  hazardSoft: "#f6dcd9",

  border: "#e8e2d2",
  borderStrong: "#c9c3b5",
} as const;

export const darkColors: typeof lightColors = {
  paper: "#0b1a22",
  paper2: "#0f232e",
  paperSunk: "#08151c",

  ink: "#e8e2d2",
  ink2: "#b6c2c9",
  inkMute: "#7e8d97",
  inkFaint: "#475862",

  brand: "#5fb7dd",
  brandStrong: "#8acef0",
  brandSoft: "#143a4f",
  brandLink: "#5fb7dd",

  go: "#5fd1c4",
  goStrong: "#7ee0d4",
  goSoft: "#0e3d36",
  goInk: "#d5f2ec",

  maybe: "#e6a062",
  maybeSoft: "#3d2a16",
  maybeInk: "#fbe9d2",

  noGo: "#6c7780",
  noGoSoft: "#1a242b",

  hazard: "#d96f67",
  hazardSoft: "#3a1816",

  border: "#1f2c34",
  borderStrong: "#2d3d47",
};

export type ThemeColors = typeof lightColors;

// Hook used inside components. Returns the right palette for the
// current OS appearance setting; falls back to light if RN can't
// tell yet (initial render on some platforms).
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}

// Verdict color helpers — keep one source of truth across components
// that render GO / MAYBE / NO_GO chips, badges, dots.
export function verdictBgColor(
  decision: "go" | "marginal" | "no_go" | null | undefined,
  c: ThemeColors,
): string {
  if (decision === "go") return c.go;
  if (decision === "marginal") return c.maybe;
  if (decision === "no_go") return c.noGo;
  return c.inkFaint;
}

export function verdictSoftColor(
  decision: "go" | "marginal" | "no_go" | null | undefined,
  c: ThemeColors,
): string {
  if (decision === "go") return c.goSoft;
  if (decision === "marginal") return c.maybeSoft;
  if (decision === "no_go") return c.noGoSoft;
  return c.paperSunk;
}

export function verdictInkColor(
  decision: "go" | "marginal" | "no_go" | null | undefined,
  c: ThemeColors,
): string {
  if (decision === "go") return c.goInk;
  if (decision === "marginal") return c.maybeInk;
  if (decision === "no_go") return c.ink2;
  return c.inkMute;
}

// Spacing tokens — replace ad-hoc paddings with named ones so layouts
// rhyme across screens. Mirrors a 4-pt grid.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

// Type scale — six named sizes used everywhere instead of raw numbers
// scattered in StyleSheets.
export const type = {
  hero: { fontSize: 48, fontWeight: "700" as const, letterSpacing: -1.5, lineHeight: 52 },
  title: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.4, lineHeight: 30 },
  body: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  bodyStrong: { fontSize: 14, fontWeight: "600" as const, lineHeight: 20 },
  meta: { fontSize: 12, fontWeight: "400" as const, color: lightColors.inkMute, lineHeight: 16 },
  label: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
  mono: { fontFamily: "Menlo", fontVariant: ["tabular-nums" as const] },
} as const;
