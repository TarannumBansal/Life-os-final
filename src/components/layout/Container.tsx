import React from "react";
import { View, ViewStyle } from "react-native";
import { useBreakpoint } from "@/src/hooks/useBreakpoint";
/** Centers content and caps width on tablet/desktop so lines aren't over-long on web.
 *  On phones it's a no-op (full width), so existing mobile layout is unchanged. */
export function Container({ children, style, maxWidth = 720 }: { children: React.ReactNode; style?: ViewStyle; maxWidth?: number }) {
  const { isWide } = useBreakpoint();
  return (
    <View style={[{ width: "100%", alignSelf: "center" }, isWide ? { maxWidth } : null, style]}>
      {children}
    </View>
  );
}
