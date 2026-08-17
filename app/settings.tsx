import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, s, r, t } from "@/src/theme";
import { useSettings } from "@/src/store/settings";
import { SyncSettings } from "@/src/components/SyncSettings";
import { today, DayOrder } from "@/src/engine/dayOrder";

export default function Settings() {
  const { c } = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const [holidayInput, setHolidayInput] = useState("");

  if (!settings) return <View style={{ flex: 1, backgroundColor: c.surface }} />;

  const setAnchorOrder = (o: DayOrder) => update((s) => ({ ...s, dayOrderConfig: { ...s.dayOrderConfig, anchorDayOrder: o, anchorDate: today() } }));

  const setWeek = (w: number) => {
    // Shift roadmapStartDate so that today's week = w
    const todayD = new Date(today());
    todayD.setDate(todayD.getDate() - (w - 1) * 7);
    const y = todayD.getFullYear(), m = String(todayD.getMonth() + 1).padStart(2, "0"), d = String(todayD.getDate()).padStart(2, "0");
    update((s) => ({ ...s, roadmapStartDate: `${y}-${m}-${d}` }));
  };
  const addHoliday = () => {
    const d = holidayInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    update((s) => ({ ...s, dayOrderConfig: { ...s.dayOrderConfig, holidays: Array.from(new Set([...s.dayOrderConfig.holidays, d])) } }));
    setHolidayInput("");
  };
  const removeHoliday = (d: string) => update((s) => ({ ...s, dayOrderConfig: { ...s.dayOrderConfig, holidays: s.dayOrderConfig.holidays.filter((h) => h !== d) } }));

  const resetAll = () => update(() => ({
    roadmapStartDate: today(),
    dayOrderConfig: { anchorDate: today(), anchorDayOrder: 1 as DayOrder, holidays: [], examDates: [] },
    todaysMode: {},
    modeHistory: [],
    flexBudgetPerMonth: 4,
    flexDayLedger: [],
    cutoffHourForDowngrade: 18,
    completions: [],
    journal: [],
    updatedAt: Date.now(),
  }));

  return (
    <View style={[styles.container, { backgroundColor: c.surface }]} testID="settings-screen">
      <SafeAreaView edges={["top"]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Pressable testID="back-settings" onPress={() => router.back()} hitSlop={10}>
            <Feather name="chevron-left" size={24} color={c.text} />
          </Pressable>
          <Text style={[styles.title, { color: c.text }]}>Settings</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: s.lg, paddingBottom: 40 }}>
        <SyncSettings />
        <Section title="ROADMAP" c={c}>
          <Row label="Start date" value={settings.roadmapStartDate} c={c} />
          <Row label="Flex-day budget / month" value={String(settings.flexBudgetPerMonth)} c={c} />
          <Row label="Downgrade cutoff hour" value={`${settings.cutoffHourForDowngrade}:00`} c={c} />
          <Text style={[styles.help, { color: c.textFaint, marginTop: s.sm }]}>Jump to any week (proves that Today's plan is derived from the current PGOS week):</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s.sm, paddingVertical: s.sm }}>
            {[1, 3, 5, 8, 12, 16, 20, 24, 28, 32].map((w) => (
              <Pressable key={w} testID={`jump-week-${w}`} onPress={() => setWeek(w)} style={[styles.doChip, { borderColor: c.border, width: 56 }]}>
                <Text style={{ color: c.textDim, fontWeight: "600", fontFamily: t.monoFont }}>W{w}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Section>

        <Section title="DAY-ORDER ENGINE" c={c}>
          <Text style={[styles.help, { color: c.textFaint }]}>Anchor · today's Day Order (rotating 1→2→3→4→5). Holidays and Sundays skip advancement.</Text>
          <View style={styles.dayOrderRow}>
            {[1, 2, 3, 4, 5].map((o) => {
              const active = settings.dayOrderConfig.anchorDayOrder === o;
              return (
                <Pressable key={o} testID={`day-order-${o}`} onPress={() => setAnchorOrder(o as DayOrder)}
                  style={[styles.doChip, { borderColor: active ? c.text : c.border, backgroundColor: active ? c.text : "transparent" }]}>
                  <Text style={{ color: active ? c.onBrand : c.textDim, fontWeight: "600", fontFamily: t.monoFont }}>{o}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="HOLIDAYS" c={c}>
          <View style={styles.inputRow}>
            <TextInput
              testID="holiday-input"
              value={holidayInput}
              onChangeText={setHolidayInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={c.textFaint}
              style={[styles.holidayInput, { color: c.text, borderColor: c.border }]}
            />
            <Pressable testID="add-holiday" onPress={addHoliday} style={[styles.addBtn, { backgroundColor: c.text }]}>
              <Text style={{ color: c.onBrand, fontWeight: "600" }}>Add</Text>
            </Pressable>
          </View>
          {settings.dayOrderConfig.holidays.length === 0 ? (
            <Text style={[styles.help, { color: c.textFaint, marginTop: s.sm }]}>No holidays set.</Text>
          ) : settings.dayOrderConfig.holidays.map((d) => (
            <Pressable key={d} testID={`remove-holiday-${d}`} onPress={() => removeHoliday(d)} style={styles.holidayRow}>
              <Text style={[styles.holidayDate, { color: c.textDim, fontFamily: t.monoFont }]}>{d}</Text>
              <Feather name="x" size={14} color={c.textFaint} />
            </Pressable>
          ))}
        </Section>

        <Section title="FLEX DAYS THIS MONTH" c={c}>
          <Row label="Used" value={String(settings.flexDayLedger.length)} c={c} />
          <Row label="Remaining" value={String(Math.max(0, settings.flexBudgetPerMonth - settings.flexDayLedger.length))} c={c} />
        </Section>

        <Section title="DATA" c={c}>
          <Pressable testID="reset-all" onPress={resetAll} style={[styles.dangerBtn, { borderColor: c.border }]}>
            <Feather name="rotate-ccw" size={14} color={c.error} />
            <Text style={{ color: c.error, fontWeight: "600", marginLeft: 8 }}>Reset all data</Text>
          </Pressable>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children, c }: { title: string; children: any; c: any }) {
  return (
    <View style={{ marginBottom: s.xl }}>
      <Text style={{ color: c.textFaint, fontFamily: t.monoFont, fontSize: 10, letterSpacing: 0.8, fontWeight: "600", marginBottom: s.sm }}>{title}</Text>
      <View style={{ backgroundColor: c.surface2, borderRadius: r.md, borderWidth: 0.5, borderColor: c.border, padding: s.md }}>{children}</View>
    </View>
  );
}
function Row({ label, value, c }: { label: string; value: string; c: any }) {
  return (
    <View style={styles.row}>
      <Text style={{ color: c.text, fontSize: t.size.base }}>{label}</Text>
      <Text style={{ color: c.textDim, fontFamily: t.monoFont, fontSize: t.size.sm }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: s.lg, paddingBottom: s.md, borderBottomWidth: 0.5 },
  title: { fontSize: t.size.md, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  help: { fontSize: t.size.sm, lineHeight: 20 },
  dayOrderRow: { flexDirection: "row", gap: s.sm, marginTop: s.sm },
  doChip: { flex: 1, height: 40, borderRadius: r.pill, borderWidth: 0.5, alignItems: "center", justifyContent: "center" },
  inputRow: { flexDirection: "row", gap: s.sm },
  holidayInput: { flex: 1, borderWidth: 0.5, borderRadius: r.md, paddingHorizontal: 12, height: 40 },
  addBtn: { paddingHorizontal: 18, borderRadius: r.md, alignItems: "center", justifyContent: "center" },
  holidayRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  holidayDate: { fontSize: t.size.sm },
  dangerBtn: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: r.md, borderWidth: 0.5, justifyContent: "center" },
});
