import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useTheme, s, r, t } from "@/src/theme";
import { Feather } from "@expo/vector-icons";
import type { DayMode } from "@/src/engine/planner";

interface Props {
  mode: DayMode;
  onChange: (m: DayMode) => void;
  freeMinutes: number;
  weekNumber: number;
  weekTheme: string;
  onWhy: () => void;
}

const MODES: { id: DayMode; label: string }[] = [
  { id: "full", label: "Full" },
  { id: "college", label: "College" },
  { id: "exam", label: "Exam" },
  { id: "flex", label: "Flex" },
];

export function DayModeHeader({ mode, onChange, freeMinutes, weekNumber, weekTheme, onWhy }: Props) {
  const { c } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: c.surface, borderBottomColor: c.border }]} testID="today-header">
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.overline, { color: c.textFaint, fontFamily: t.monoFont }]}>WEEK {weekNumber} · {Math.round(freeMinutes / 60)}h free</Text>
          <Text style={[styles.theme, { color: c.text }]} numberOfLines={1}>{weekTheme}</Text>
        </View>
        <Pressable testID="why-this-plan-button" onPress={onWhy} style={[styles.whyBtn, { borderColor: c.border }]}>
          <Feather name="info" size={13} color={c.textDim} />
          <Text style={[styles.whyText, { color: c.textDim }]}>Why this plan?</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <Pressable key={m.id} testID={`day-mode-${m.id}`} onPress={() => onChange(m.id)}
              style={[styles.chip, { borderColor: active ? c.text : c.border, backgroundColor: active ? c.text : "transparent" }]}>
              <Text style={{ color: active ? c.onBrand : c.textDim, fontSize: t.size.sm, fontWeight: "600" }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: s.md, paddingHorizontal: s.lg, paddingBottom: s.md, borderBottomWidth: 0.5 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  overline: { fontSize: t.size.xs, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "600" },
  theme: { fontSize: t.size.md, fontWeight: "700", marginTop: 2 },
  whyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: r.pill, borderWidth: 0.5 },
  whyText: { fontSize: t.size.xs, fontWeight: "500" },
  chipsRow: { gap: s.sm, paddingTop: s.md, paddingRight: s.lg },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: r.pill, borderWidth: 0.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
