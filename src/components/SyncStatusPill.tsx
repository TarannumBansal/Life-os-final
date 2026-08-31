import React from "react";
import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/src/theme";
import { useSync } from "@/src/sync/useSync";
/** Calm, subtle sync indicator. Renders nothing when sync is disabled (local-only build). */
export function SyncStatusPill() {
  const { c } = useTheme();
  const { status, label, syncNow, enabled } = useSync();
  if (!enabled) return null;
  const dot = status === "synced" ? c.success : status === "offline" ? c.textFaint : status === "error" ? c.warning : c.info;
  return (
    <Pressable onPress={syncNow} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 8 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
      <Text style={{ color: c.textFaint, fontSize: 11, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
