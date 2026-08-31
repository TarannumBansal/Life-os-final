import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useTheme, s, r, t } from "@/src/theme";
import { useSettings } from "@/src/store/settings";
import { today } from "@/src/engine/dayOrder";
import { addScheduleLog, removeScheduleLog } from "@/src/store/repositories";

/** Minimal real-life schedule-log editor. A simple time block — not a project system. */
export function ScheduleLogEditor() {
  const { c } = useTheme();
  const { settings, update } = useSettings();
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("19:45");
  const [recurring, setRecurring] = useState(false);
  if (!settings) return null;

  const add = () => {
    if (!title.trim()) return;
    update((st) => addScheduleLog(st, { title: title.trim(), startDate, endDate: endDate || undefined, startTime, endTime, recurring }));
    setTitle("");
  };

  return (
    <View style={[styles.card, { borderColor: c.border, backgroundColor: c.surface2 }]} testID="schedule-editor">
      <Text style={[styles.h, { color: c.textFaint }]}>REAL-LIFE SCHEDULE</Text>
      {settings.scheduleLogs.map((l) => (
        <View key={l.id} style={styles.row}>
          <Text style={{ color: c.text, fontSize: 13, flex: 1 }}>{l.title} · {l.startTime}–{l.endTime}{l.recurring ? ` · ${l.startDate}→${l.endDate ?? "…"}` : ` · ${l.startDate}`}</Text>
          <Pressable onPress={() => update((st) => removeScheduleLog(st, l.id))} hitSlop={6}><Text style={{ color: c.textFaint }}>×</Text></Pressable>
        </View>
      ))}
      <TextInput value={title} onChangeText={setTitle} placeholder="title (e.g. Startup Work)" placeholderTextColor={c.textFaint} style={[styles.in, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]} />
      <View style={styles.grid}>
        <Field c={c} label="start date" v={startDate} set={setStartDate} />
        <Field c={c} label="end date (opt)" v={endDate} set={setEndDate} />
        <Field c={c} label="start" v={startTime} set={setStartTime} />
        <Field c={c} label="end" v={endTime} set={setEndTime} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: s.sm, marginTop: s.sm }}>
        <Pressable onPress={() => setRecurring((x) => !x)} style={[styles.chip, { borderColor: c.border, backgroundColor: recurring ? c.text : "transparent" }]}>
          <Text style={{ color: recurring ? c.surface : c.textDim, fontSize: 12 }}>{recurring ? "Recurring / range" : "One-time"}</Text>
        </Pressable>
        <Pressable onPress={add} style={[styles.addBtn, { backgroundColor: c.brand }]}><Text style={{ color: c.onBrand, fontWeight: "700" }}>Add block</Text></Pressable>
      </View>
      <Text style={{ color: c.textFaint, fontSize: 11, marginTop: s.sm }}>This time becomes unavailable — LifeOS plans PGOS work around it automatically.</Text>
    </View>
  );
}
function Field({ c, label, v, set }: any) {
  return (
    <View style={{ width: "48%" }}>
      <Text style={{ color: c.textFaint, fontSize: 10, marginBottom: 2 }}>{label}</Text>
      <TextInput value={v} onChangeText={set} placeholderTextColor={c.textFaint} style={[styles.in, { borderColor: c.border, color: c.text, backgroundColor: c.surface, marginTop: 0 }]} />
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderWidth: 0.5, borderRadius: r.md, padding: s.md, marginBottom: s.lg },
  h: { fontSize: 10, letterSpacing: 0.8, fontWeight: "700", marginBottom: s.sm },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  in: { borderWidth: 0.5, borderRadius: r.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginTop: s.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: s.xs },
  chip: { borderWidth: 0.5, borderRadius: r.pill, paddingHorizontal: 12, paddingVertical: 6 },
  addBtn: { borderRadius: r.sm, paddingHorizontal: 16, paddingVertical: 8, marginLeft: "auto" },
});
