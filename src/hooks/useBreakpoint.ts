import { useWindowDimensions } from "react-native";
/** Responsive tiers for cross-platform layout. phone < 700 < tablet < 1024 < desktop. */
export type Breakpoint = "phone" | "tablet" | "desktop";
export function useBreakpoint(): { bp: Breakpoint; width: number; isWide: boolean; columns: number } {
  const { width } = useWindowDimensions();
  const bp: Breakpoint = width >= 1024 ? "desktop" : width >= 700 ? "tablet" : "phone";
  return { bp, width, isWide: bp !== "phone", columns: bp === "desktop" ? 3 : bp === "tablet" ? 2 : 1 };
}
