import { useColorScheme } from "react-native";

export type ThemeName = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  surface2: "#F9FAFB",
  surface3: "#F3F4F6",
  text: "#111827",
  textDim: "#4B5563",
  textFaint: "#6B7280",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  divider: "#F3F4F6",
  brand: "#111827",
  onBrand: "#FFFFFF",
  success: "#166534",
  warning: "#9A3412",
  error: "#991B1B",
  info: "#374151",
  overlay: "rgba(17,24,39,0.5)",
};

const dark = {
  surface: "#0A0A0A",
  surface2: "#141414",
  surface3: "#1F1F1F",
  text: "#F9FAFB",
  textDim: "#D1D5DB",
  textFaint: "#9CA3AF",
  border: "#27272A",
  borderStrong: "#3F3F46",
  divider: "#1C1C1C",
  brand: "#FFFFFF",
  onBrand: "#0A0A0A",
  success: "#22C55E",
  warning: "#F97316",
  error: "#EF4444",
  info: "#9CA3AF",
  overlay: "rgba(0,0,0,0.6)",
};

// 9 PGOS domains — muted, engineering-grade palette (no purple/indigo/bright blue).
export const DOMAIN_COLORS: Record<string, { light: string; dark: string; label: string; short: string }> = {
  tech:   { light: "#334155", dark: "#94A3B8", label: "Technical", short: "TECH" },
  comm:   { light: "#9A3412", dark: "#FB923C", label: "Personal Brand", short: "COMM" },
  prod:   { light: "#57534E", dark: "#D6D3D1", label: "AI Productivity", short: "PROD" },
  know:   { light: "#4D7C0F", dark: "#A3E635", label: "Knowledge", short: "KNOW" },
  fin:    { light: "#15803D", dark: "#4ADE80", label: "Finance", short: "FIN"  },
  health: { light: "#65A30D", dark: "#BEF264", label: "Health", short: "HEALTH" },
  mind:   { light: "#B45309", dark: "#FCD34D", label: "Mindset", short: "MIND" },
  prof:   { light: "#3F3F46", dark: "#A1A1AA", label: "Professional", short: "PROF" },
  skills: { light: "#CA8A04", dark: "#FACC15", label: "Skills & Craft", short: "SKILLS" },
};

export function domainColor(id: string, mode: ThemeName): string {
  const d = DOMAIN_COLORS[id];
  if (!d) return mode === "dark" ? dark.textFaint : light.textFaint;
  return d[mode];
}

export function useTheme() {
  const scheme = useColorScheme();
  const mode: ThemeName = scheme === "dark" ? "dark" : "light";
  const c = mode === "dark" ? dark : light;
  return { mode, c, s, r, t };
}

export const s = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 48 };
export const r = { sm: 6, md: 12, lg: 20, pill: 999 };
export const t = {
  displayFont: undefined as string | undefined,
  textFont: undefined as string | undefined,
  monoFont: "Menlo" as string,
  size: { xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 24, xxl: 32 },
  weight: { regular: "400" as const, medium: "500" as const, semi: "600" as const, bold: "700" as const, heavy: "800" as const },
};
