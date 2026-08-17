import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTheme, s, r } from "@/src/theme";
import { Container } from "@/src/components/layout/Container";
import { useSettings, currentWeekNumber } from "@/src/store/settings";
import { deriveDay } from "@/src/engine/dayOrder";

/** Execution Calendar — represents the system over time: Day Orders, week/phase,
 *  exams, holidays, flex days, Sundays (review), Saturday STEP. */
export default function CalendarScreen() {
  const { c, mode } = useTheme();
  const { settings } = useSettings();
  const [monthOffset, setMonthOffset] = useState(0);
  if (!settings) return <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}><Text style={{ color: c.textDim, padding: 24 }}>Loading…</Text></SafeAreaView>;

  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const monthName = base.toLocaleString("default", { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0

  const cells: (null | { day: number; iso: string })[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, iso });
  }

  const kindColor = (kind: string): string => {
    switch (kind) {
      case "exam": return c.error;
      case "holiday": return c.warning;
      case "sat_step": return c.info;
      case "sunday": return c.textFaint;
      default: return c.text;
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.surface }]} testID="calendar-screen">
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <SafeAreaView edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: s.lg, paddingBottom: 60 }}>
          <Container>
            <Text style={[styles.kicker, { color: c.textFaint }]}>EXECUTION CALENDAR</Text>
            <View style={styles.navRow}>
              <Pressable onPress={() => setMonthOffset((m) => m - 1)}><Text style={{ color: c.textDim, fontSize: 20 }}>‹</Text></Pressable>
              <Text style={[styles.h1, { color: c.text }]}>{monthName}</Text>
              <Pressable onPress={() => setMonthOffset((m) => m + 1)}><Text style={{ color: c.textDim, fontSize: 20 }}>›</Text></Pressable>
            </View>

            <View style={styles.weekHead}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <Text key={i} style={{ flex: 1, textAlign: "center", color: c.textFaint, fontSize: 11, fontWeight: "700" }}>{d}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((cell, i) => {
                if (!cell) return <View key={i} style={styles.cell} />;
                const day = deriveDay(cell.iso, settings.dayOrderConfig);
                const wk = currentWeekNumber(settings.roadmapStartDate, cell.iso);
                const isFlex = settings.flexDayLedger.some((f) => f.date === cell.iso);
                const col = isFlex ? c.success : kindColor(day.kind);
                return (
                  <View key={i} style={[styles.cell, { borderColor: c.border }]}>
                    <Text style={{ color: col, fontSize: 13, fontWeight: "700" }}>{cell.day}</Text>
                    <Text style={{ color: c.textFaint, fontSize: 9 }}>
                      {isFlex ? "Flex" : day.kind === "college" ? `DO${day.dayOrder}` : day.kind === "sat_step" ? "STEP" : day.kind === "sunday" ? "Rev" : day.kind === "exam" ? "Exam" : "Hol"}
                    </Text>
                    <Text style={{ color: c.textFaint, fontSize: 8 }}>W{wk}</Text>
                  </View>
                );
              })}
            </View>

            <View style={{ marginTop: s.lg }}>
              <Text style={{ color: c.textFaint, fontSize: 11, fontWeight: "700", marginBottom: s.xs }}>LEGEND</Text>
              <Text style={{ color: c.textDim, fontSize: 12, lineHeight: 20 }}>
                DO1–5 = Day Order · STEP = Saturday class · Rev = Sunday review · Exam / Hol = exam / holiday · Flex = flex day · W# = roadmap week
              </Text>
            </View>
          </Container>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: s.sm },
  h1: { fontSize: 22, fontWeight: "800" },
  weekHead: { flexDirection: "row", marginBottom: s.xs },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, borderWidth: 0.5, alignItems: "center", justifyContent: "center", padding: 2 },
});
