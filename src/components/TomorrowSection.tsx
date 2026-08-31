import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useTheme, s, r } from "@/src/theme";
import { useSettings } from "@/src/store/settings";
import { sortedTomorrow, TomorrowKind } from "@/src/engine/tomorrow";
import { addTomorrow, updateTomorrow, removeTomorrow, reorderTomorrow } from "@/src/store/repositories";

const KINDS: TomorrowKind[] = ["priority", "remember", "note"];
/** Lightweight "what to have ready for tomorrow" — NOT Journal, NOT tasks, NOT PGOS. */
export function TomorrowSection() {
  const { c } = useTheme();
  const { settings, update } = useSettings();
  const [kind, setKind] = useState<TomorrowKind>("priority");
  const [text, setText] = useState("");
  if (!settings) return null;
  const notes = sortedTomorrow(settings.tomorrow);

  const add = () => { if (!text.trim()) return; update((st) => addTomorrow(st, kind, text.trim())); setText(""); };
  const move = (id: string, dir: -1 | 1) => {
    const arr = sortedTomorrow(settings.tomorrow); const idx = arr.findIndex((t) => t.id === id);
    const swap = arr[idx + dir]; if (!swap) return;
    update((st) => reorderTomorrow(reorderTomorrow(st, id, swap.order), swap.id, arr[idx].order));
  };

  return (
    <View style={[styles.card, { borderColor: c.border, backgroundColor: c.surface2 }]} testID="tomorrow-section">
      <Text style={[styles.h, { color: c.textFaint }]}>TOMORROW</Text>
      {notes.length === 0 && <Text style={{ color: c.textFaint, fontSize: 12, marginBottom: s.sm }}>What do you want ready for tomorrow?</Text>}
      {notes.map((n, i) => (
        <View key={n.id} style={styles.row}>
          <Text style={{ color: c.textFaint, fontSize: 10, width: 62, fontWeight: "700" }}>{n.kind.toUpperCase()}</Text>
          <Text style={{ color: c.text, fontSize: 13, flex: 1 }}>{n.text}</Text>
          <Pressable onPress={() => move(n.id, -1)} hitSlop={6}><Text style={{ color: c.textFaint, fontSize: 14, paddingHorizontal: 4 }}>↑</Text></Pressable>
          <Pressable onPress={() => move(n.id, 1)} hitSlop={6}><Text style={{ color: c.textFaint, fontSize: 14, paddingHorizontal: 4 }}>↓</Text></Pressable>
          <Pressable onPress={() => update((st) => removeTomorrow(st, n.id))} hitSlop={6}><Text style={{ color: c.textFaint, fontSize: 14, paddingHorizontal: 4 }}>×</Text></Pressable>
        </View>
      ))}
      <View style={styles.addRow}>
        {KINDS.map((k) => (
          <Pressable key={k} onPress={() => setKind(k)} style={[styles.chip, { borderColor: c.border, backgroundColor: kind === k ? c.text : "transparent" }]}>
            <Text style={{ color: kind === k ? c.surface : c.textDim, fontSize: 11, textTransform: "capitalize" }}>{k}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: s.sm, marginTop: s.sm }}>
        <TextInput value={text} onChangeText={setText} placeholder="add a note for tomorrow" placeholderTextColor={c.textFaint}
          onSubmitEditing={add} style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]} />
        <Pressable onPress={add} style={[styles.addBtn, { backgroundColor: c.brand }]}><Text style={{ color: c.onBrand, fontWeight: "700" }}>Add</Text></Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderWidth: 0.5, borderRadius: r.md, padding: s.md, marginBottom: s.md },
  h: { fontSize: 10, letterSpacing: 0.8, fontWeight: "700", marginBottom: s.sm },
  row: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5 },
  addRow: { flexDirection: "row", gap: s.xs, marginTop: s.sm },
  chip: { borderWidth: 0.5, borderRadius: r.pill, paddingHorizontal: 10, paddingVertical: 4 },
  input: { flex: 1, borderWidth: 0.5, borderRadius: r.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  addBtn: { borderRadius: r.sm, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
});
