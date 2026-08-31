import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Modal, ScrollView, StyleSheet } from "react-native";
import { useTheme, s, r, t } from "@/src/theme";
import { useSettings } from "@/src/store/settings";
import { scheduleBlocksForDate } from "@/src/engine/schedule";
import { addScheduleLog, updateScheduleLog, removeScheduleLog } from "@/src/store/repositories";

/** One editor for a single date's real-life schedule logs. Reads/writes the SAME shared-store
 *  scheduleLogs used by Today/timeline — so a change here shows up on Today immediately and vice
 *  versa. Creates NO PGOS tasks. */
export function ScheduleDaySheet({ dateISO, visible, onClose }: { dateISO: string; visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const { settings, update } = useSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("19:00");
  const [endDate, setEndDate] = useState("");
  const [recurring, setRecurring] = useState(false);

  if (!settings) return null;
  const blocks = scheduleBlocksForDate(settings.scheduleLogs, dateISO);

  const resetForm = () => { setEditingId(null); setTitle(""); setStartTime("17:00"); setEndTime("19:00"); setEndDate(""); setRecurring(false); };
  const loadForEdit = (id: string) => {
    const log = settings.scheduleLogs.find((l) => l.id === id); if (!log) return;
    setEditingId(id); setTitle(log.title); setStartTime(log.startTime); setEndTime(log.endTime);
    setEndDate(log.endDate ?? ""); setRecurring(log.recurring);
  };
  const save = () => {
    if (!title.trim()) return;
    if (editingId) update((st) => updateScheduleLog(st, editingId, { title: title.trim(), startTime, endTime, endDate: endDate || undefined, recurring }));
    else update((st) => addScheduleLog(st, { title: title.trim(), startDate: dateISO, endDate: endDate || undefined, startTime, endTime, recurring }));
    resetForm();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]} testID="schedule-day-sheet">
        <View style={styles.head}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "800" }}>{dateISO}</Text>
          <Pressable onPress={onClose} hitSlop={10}><Text style={{ color: c.textFaint, fontSize: 20 }}>×</Text></Pressable>
        </View>
        <ScrollView style={{ maxHeight: 420 }}>
          <Text style={[styles.label, { color: c.textFaint }]}>REAL-LIFE COMMITMENTS THIS DAY</Text>
          {blocks.length === 0 && <Text style={{ color: c.textFaint, fontSize: 12, marginBottom: s.sm }}>None yet. Add one below.</Text>}
          {blocks.map((b) => (
            <View key={b.id} style={[styles.logRow, { borderColor: c.border }]}>
              <Text style={{ color: c.textFaint, fontSize: 12, width: 96, fontFamily: t.monoFont }}>{b.start}–{b.end}</Text>
              <Text style={{ color: c.text, fontSize: 13, flex: 1 }}>{b.title}</Text>
              <Pressable onPress={() => loadForEdit(b.id)} hitSlop={6}><Text style={{ color: c.info, fontSize: 12, paddingHorizontal: 6 }}>Edit</Text></Pressable>
              <Pressable onPress={() => update((st) => removeScheduleLog(st, b.id))} hitSlop={6}><Text style={{ color: c.error, fontSize: 12 }}>Delete</Text></Pressable>
            </View>
          ))}

          <Text style={[styles.label, { color: c.textFaint, marginTop: s.lg }]}>{editingId ? "EDIT COMMITMENT" : "ADD COMMITMENT"}</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="title (e.g. Startup work)" placeholderTextColor={c.textFaint} style={[styles.in, { borderColor: c.border, color: c.text, backgroundColor: c.surface2 }]} />
          <View style={styles.grid}>
            <Field c={c} label="start" v={startTime} set={setStartTime} />
            <Field c={c} label="end" v={endTime} set={setEndTime} />
            <Field c={c} label="repeat until (opt)" v={endDate} set={setEndDate} />
            <View style={{ width: "48%", justifyContent: "flex-end" }}>
              <Pressable onPress={() => setRecurring((x) => !x)} style={[styles.chip, { borderColor: c.border, backgroundColor: recurring ? c.text : "transparent" }]}>
                <Text style={{ color: recurring ? c.surface : c.textDim, fontSize: 12 }}>{recurring ? "Recurring" : "One-time"}</Text>
              </Pressable>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: s.sm, marginTop: s.md }}>
            <Pressable onPress={save} style={[styles.btn, { backgroundColor: c.brand }]}><Text style={{ color: c.onBrand, fontWeight: "700" }}>{editingId ? "Save changes" : "Add commitment"}</Text></Pressable>
            {editingId ? <Pressable onPress={resetForm} style={[styles.btn, { borderWidth: 0.5, borderColor: c.border }]}><Text style={{ color: c.textDim }}>Cancel</Text></Pressable> : null}
          </View>
          <Text style={{ color: c.textFaint, fontSize: 11, marginTop: s.sm, marginBottom: s.lg }}>This blocks real-life time. LifeOS arranges PGOS work around it — it never creates tasks.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
function Field({ c, label, v, set }: any) {
  return (
    <View style={{ width: "48%" }}>
      <Text style={{ color: c.textFaint, fontSize: 10, marginBottom: 2 }}>{label}</Text>
      <TextInput value={v} onChangeText={set} placeholderTextColor={c.textFaint} style={[styles.in, { borderColor: c.border, color: c.text, backgroundColor: c.surface2, marginTop: 0 }]} />
    </View>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 0.5, padding: s.lg, paddingBottom: s.xl },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: s.md },
  label: { fontSize: 10, letterSpacing: 0.8, fontWeight: "700", marginBottom: s.sm },
  logRow: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 0.5, paddingVertical: s.sm },
  in: { borderWidth: 0.5, borderRadius: r.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginTop: s.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: s.xs },
  chip: { borderWidth: 0.5, borderRadius: r.pill, paddingVertical: 8, alignItems: "center" },
  btn: { flex: 1, borderRadius: r.sm, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
});
