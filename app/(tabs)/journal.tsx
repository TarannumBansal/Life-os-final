import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, s, r, t } from "@/src/theme";
import { useSettings } from "@/src/store/settings";
import { today } from "@/src/engine/dayOrder";

type Tab = "journal" | "reviews" | "followups";

export default function Journal() {
  const { c } = useTheme();
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<Tab>("journal");
  const [text, setText] = useState("");

  const save = async () => {
    const txt = text.trim();
    if (!txt) return;
    const now = Date.now();
    const entry = { id: `j-${now}`, date: today(), text: txt, ts: now, updatedAt: now };
    await update((s) => ({ ...s, journal: [entry, ...s.journal] }));
    setText("");
  };
  const del = async (id: string) => update((s) => ({ ...s, journal: s.journal.filter((j) => j.id !== id) }));
  const toggleFollowUp = async (id: string) =>
    update((s) => ({ ...s, followUps: s.followUps.map((f) => f.id === id ? { ...f, done: !f.done, updatedAt: Date.now() } : f) }));
  const delFeedback = async (id: string) => update((s) => ({ ...s, feedbackLog: s.feedbackLog.filter((f) => f.id !== id) }));

  const entries = settings?.journal ?? [];
  const feedback = settings?.feedbackLog ?? [];
  const followUps = settings?.followUps ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.container, { backgroundColor: c.surface }]} testID="journal-screen">
        <SafeAreaView edges={["top"]}>
          <View style={[styles.header, { borderBottomColor: c.border }]}>
            <Text style={[styles.overline, { color: c.textFaint, fontFamily: t.monoFont }]}>REFLECTIONS · AI REVIEWS · FOLLOW-UPS</Text>
            <Text style={[styles.title, { color: c.text }]}>Journal</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentRow}>
            {(["journal", "reviews", "followups"] as Tab[]).map((k) => {
              const active = tab === k;
              return (
                <Pressable key={k} testID={`journal-tab-${k}`} onPress={() => setTab(k)}
                  style={[styles.segment, { borderColor: active ? c.text : c.border, backgroundColor: active ? c.text : "transparent" }]}>
                  <Text style={{ color: active ? c.onBrand : c.textDim, fontSize: t.size.sm, fontWeight: "600" }}>
                    {k === "journal" ? "Journal" : k === "reviews" ? `AI Reviews · ${feedback.length}` : `Follow-ups · ${followUps.filter((f) => !f.done).length}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>

        {tab === "journal" ? (
          <>
            <View style={[styles.composer, { backgroundColor: c.surface2, borderColor: c.border }]}>
              <TextInput
                testID="journal-input"
                value={text} onChangeText={setText} multiline
                placeholder="3 lines · what went right · what didn't · one lesson."
                placeholderTextColor={c.textFaint}
                style={[styles.input, { color: c.text }]}
              />
              <Pressable testID="save-journal" onPress={save} style={[styles.saveBtn, { backgroundColor: c.text }]}>
                <Feather name="check" size={16} color={c.onBrand} />
                <Text style={{ color: c.onBrand, fontWeight: "600", marginLeft: 6 }}>Save entry</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: s.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              {entries.length === 0 ? (
                <Empty text="No entries yet. Write your first reflection." c={c} />
              ) : entries.map((j) => (
                <View key={j.id} style={[styles.card, { backgroundColor: c.surface2, borderColor: c.border }]} testID={`journal-entry-${j.id}`}>
                  <View style={styles.cardHead}>
                    <Text style={[styles.date, { color: c.textFaint, fontFamily: t.monoFont }]}>{j.date}</Text>
                    <Pressable testID={`delete-${j.id}`} onPress={() => del(j.id)} hitSlop={10}>
                      <Feather name="trash-2" size={14} color={c.textFaint} />
                    </Pressable>
                  </View>
                  <Text style={[styles.body, { color: c.text }]}>{j.text}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        ) : tab === "reviews" ? (
          <ScrollView contentContainerStyle={{ padding: s.lg, paddingBottom: 40 }}>
            {feedback.length === 0 ? (
              <Empty text="No AI reviews yet. When you finish a reviewable task on Today, LifeOS will prepare a copy-paste prompt for your preferred assistant." c={c} />
            ) : feedback.map((fb) => (
              <View key={fb.id} style={[styles.card, { backgroundColor: c.surface2, borderColor: c.border }]} testID={`feedback-${fb.id}`}>
                <View style={styles.cardHead}>
                  <Text style={[styles.date, { color: c.textFaint, fontFamily: t.monoFont }]}>W{fb.weekNumber} · {fb.kind.toUpperCase()}</Text>
                  <Pressable onPress={() => delFeedback(fb.id)} hitSlop={10} testID={`delete-feedback-${fb.id}`}>
                    <Feather name="trash-2" size={14} color={c.textFaint} />
                  </Pressable>
                </View>
                <Text style={[styles.body, { color: c.text }]}>{fb.itemTitle}</Text>
                {!!fb.reviewer && <Text style={[styles.small, { color: c.textFaint }]}>Reviewer: {fb.reviewer}</Text>}
                {!!fb.strengths && <Row label="STRENGTHS" body={fb.strengths} c={c} />}
                {!!fb.weaknesses && <Row label="WEAKNESSES" body={fb.weaknesses} c={c} />}
                {!!fb.improvements && <Row label="IMPROVEMENTS" body={fb.improvements} c={c} />}
                {fb.actionItems.length ? <Row label="ACTION ITEMS" body={fb.actionItems.map((a) => `• ${a}`).join("\n")} c={c} /> : null}
              </View>
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: s.lg, paddingBottom: 40 }}>
            {followUps.length === 0 ? (
              <Empty text="No follow-ups yet. Action items from AI reviews arrive here as scheduled tasks." c={c} />
            ) : followUps.map((f) => (
              <Pressable key={f.id} testID={`followup-${f.id}`} onPress={() => toggleFollowUp(f.id)} style={[styles.card, { backgroundColor: c.surface2, borderColor: c.border, flexDirection: "row", gap: s.md }]}>
                <View style={[styles.check, { borderColor: f.done ? c.text : c.borderStrong, backgroundColor: f.done ? c.text : "transparent" }]}>
                  {f.done ? <Feather name="check" size={13} color={c.onBrand} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.body, { color: c.text, textDecorationLine: f.done ? "line-through" : "none" }]}>{f.title}</Text>
                  <Text style={[styles.small, { color: c.textFaint }]}>Due W{f.dueWeek ?? "—"} · from AI feedback</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Empty({ text, c }: any) {
  return (
    <View style={[styles.empty, { borderColor: c.border }]}>
      <Text style={[styles.emptyText, { color: c.textFaint }]}>{text}</Text>
    </View>
  );
}
function Row({ label, body, c }: any) {
  return (
    <View style={{ marginTop: s.sm }}>
      <Text style={{ color: c.textFaint, fontFamily: t.monoFont, fontSize: 10, letterSpacing: 0.8, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: c.textDim, fontSize: t.size.sm, marginTop: 3, lineHeight: 19 }}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: s.lg, paddingBottom: s.md, borderBottomWidth: 0 },
  overline: { fontSize: 10, letterSpacing: 0.8, fontWeight: "600" },
  title: { fontSize: t.size.xxl, fontWeight: "800", marginTop: 2, letterSpacing: -0.5 },
  segmentRow: { flexDirection: "row", gap: s.sm, paddingHorizontal: s.lg, paddingBottom: s.md },
  segment: { height: 36, paddingHorizontal: 14, borderRadius: r.pill, borderWidth: 0.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  composer: { marginHorizontal: s.lg, marginTop: s.sm, borderRadius: r.md, borderWidth: 0.5, padding: s.md },
  input: { minHeight: 80, fontSize: t.size.base, lineHeight: 22 },
  saveBtn: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: r.md, marginTop: s.sm },
  card: { borderRadius: r.md, borderWidth: 0.5, padding: s.md, marginBottom: s.sm },
  cardHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: s.sm },
  date: { fontSize: 10, letterSpacing: 0.8, fontWeight: "700" },
  body: { fontSize: t.size.base, lineHeight: 22 },
  small: { fontSize: 12, marginTop: 4 },
  empty: { padding: s.xl, borderRadius: r.md, borderWidth: 0.5, borderStyle: "dashed", alignItems: "center" },
  emptyText: { fontSize: t.size.sm, textAlign: "center" },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 2 },
});
