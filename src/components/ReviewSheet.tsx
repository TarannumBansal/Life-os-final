/**
 * ReviewSheet — the AI Review workflow UI.
 * Model-agnostic: builds a copy-paste prompt embedding PGOS week context, and captures
 * feedback (strengths / weaknesses / improvements / action items) into the feedback log.
 * Action items can be converted into scheduled follow-up tasks.
 */
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView, Modal, Dimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useTheme, s, r, t } from "@/src/theme";
import { buildReviewPrompt, extractActionItems, FeedbackEntry, ReviewKind } from "@/src/engine/reviewable";
import { useSettings, currentWeekNumber } from "@/src/store/settings";
import type { Task } from "@/src/engine/planner";
import { today } from "@/src/engine/dayOrder";

interface Props {
  task: Task | null;
  onClose: () => void;
}

export function ReviewSheet({ task, onClose }: Props) {
  const { c } = useTheme();
  const { settings, update } = useSettings();
  const [step, setStep] = useState<"prompt" | "log">("prompt");
  const [artefactLink, setArtefactLink] = useState("");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [improvements, setImprovements] = useState("");
  const [actionText, setActionText] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [copied, setCopied] = useState(false);

  const weekNumber = settings ? currentWeekNumber(settings.roadmapStartDate) : 1;

  const prompt = useMemo(() => {
    if (!task) return "";
    return buildReviewPrompt({
      kind: (task.reviewKind as ReviewKind) || "project-evaluation",
      weekNumber,
      itemTitle: task.title,
      itemDetail: task.detail || "",
      artefactLink: artefactLink || undefined,
    });
  }, [task, weekNumber, artefactLink]);

  const doCopy = async () => {
    await Clipboard.setStringAsync(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reset = () => {
    setStep("prompt");
    setArtefactLink(""); setStrengths(""); setWeaknesses("");
    setImprovements(""); setActionText(""); setReviewer("");
  };

  const save = async () => {
    if (!task || !settings) return;
    const now = Date.now();
    const actionItems = extractActionItems(actionText);
    const entry: FeedbackEntry = {
      id: `fb-${now}`, ts: now, updatedAt: now, date: today(),
      weekNumber, itemId: task.weekItemId || task.id, itemTitle: task.title,
      kind: (task.reviewKind as ReviewKind) || "project-evaluation",
      artefactLink: artefactLink || undefined,
      reviewer: reviewer || undefined,
      strengths, weaknesses, improvements,
      actionItems, applied: false,
    };
    const newFollowUps = actionItems.map((title, i) => ({
      id: `fu-${now}-${i}`, fromFeedbackId: entry.id, title,
      done: false, createdAt: now, updatedAt: now,
      dueWeek: Math.min(32, weekNumber + 1),
    }));
    await update((s) => ({
      ...s,
      feedbackLog: [entry, ...s.feedbackLog],
      followUps: [...newFollowUps, ...s.followUps],
    }));
    reset();
    onClose();
  };

  if (!task) return null;

  return (
    <Modal transparent visible={!!task} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: c.text }]}>{step === "prompt" ? "Prepare a review" : "Log the feedback"}</Text>
          <Pressable onPress={onClose} hitSlop={10} testID="close-review">
            <Feather name="x" size={20} color={c.textDim} />
          </Pressable>
        </View>

        {step === "prompt" ? (
          <ScrollView contentContainerStyle={{ paddingBottom: s.lg }}>
            <Text style={[styles.overline, { color: c.textFaint, fontFamily: t.monoFont }]}>ARTEFACT (OPTIONAL)</Text>
            <TextInput
              testID="review-artefact-input"
              placeholder="Paste repo/PR/blog/artifact link"
              placeholderTextColor={c.textFaint}
              value={artefactLink}
              onChangeText={setArtefactLink}
              style={[styles.input, { color: c.text, borderColor: c.border }]}
            />

            <Text style={[styles.overline, { color: c.textFaint, fontFamily: t.monoFont, marginTop: s.md }]}>COPY-PASTE INTO CHATGPT · CLAUDE · GEMINI · GROK</Text>
            <View style={[styles.promptBox, { backgroundColor: c.surface2, borderColor: c.border }]}>
              <Text style={[styles.promptText, { color: c.textDim }]} selectable>{prompt}</Text>
            </View>
            <View style={styles.actionRow}>
              <Pressable testID="copy-prompt" onPress={doCopy} style={[styles.primaryBtn, { backgroundColor: c.text }]}>
                <Feather name={copied ? "check" : "copy"} size={14} color={c.onBrand} />
                <Text style={{ color: c.onBrand, fontWeight: "600", marginLeft: 6 }}>{copied ? "Copied" : "Copy prompt"}</Text>
              </Pressable>
              <Pressable testID="review-next" onPress={() => setStep("log")} style={[styles.secondaryBtn, { borderColor: c.border }]}>
                <Text style={{ color: c.text, fontWeight: "600" }}>I got feedback →</Text>
              </Pressable>
            </View>
            <Text style={[styles.note, { color: c.textFaint }]}>LifeOS is model-agnostic — use whichever assistant you prefer. Nothing is sent from this device.</Text>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: s.lg }} keyboardShouldPersistTaps="handled">
            <Field label="REVIEWER (OPTIONAL)" placeholder="ChatGPT · Claude · Gemini · a friend" value={reviewer} onChange={setReviewer} c={c} testID="fb-reviewer" />
            <Field label="STRENGTHS" placeholder="What was strong?" value={strengths} onChange={setStrengths} c={c} multiline testID="fb-strengths" />
            <Field label="WEAKNESSES" placeholder="What was weak?" value={weaknesses} onChange={setWeaknesses} c={c} multiline testID="fb-weaknesses" />
            <Field label="CONCRETE IMPROVEMENTS" placeholder="Fixes to make right now" value={improvements} onChange={setImprovements} c={c} multiline testID="fb-improvements" />
            <Field label="ACTION ITEMS (- or 1. per line)" placeholder={"- learn dependency injection\n- write tests before next feature"} value={actionText} onChange={setActionText} c={c} multiline testID="fb-actions" />
            <View style={styles.actionRow}>
              <Pressable testID="save-feedback" onPress={save} style={[styles.primaryBtn, { backgroundColor: c.text }]}>
                <Feather name="check" size={14} color={c.onBrand} />
                <Text style={{ color: c.onBrand, fontWeight: "600", marginLeft: 6 }}>Save + schedule follow-ups</Text>
              </Pressable>
              <Pressable testID="review-back" onPress={() => setStep("prompt")} style={[styles.secondaryBtn, { borderColor: c.border }]}>
                <Text style={{ color: c.text, fontWeight: "600" }}>← Back</Text>
              </Pressable>
            </View>
            <Text style={[styles.note, { color: c.textFaint }]}>Action items become scheduled follow-ups in Week {Math.min(32, weekNumber + 1)}.</Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder, multiline, c, testID }: any) {
  return (
    <View style={{ marginTop: s.md }}>
      <Text style={[styles.overline, { color: c.textFaint, fontFamily: t.monoFont }]}>{label}</Text>
      <TextInput
        testID={testID}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        style={[styles.input, { color: c.text, borderColor: c.border, minHeight: multiline ? 70 : 40 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: s.md, right: s.md, top: 60, bottom: 40, borderRadius: r.lg, borderWidth: 0.5, padding: s.lg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: s.md },
  title: { fontSize: t.size.lg, fontWeight: "700" },
  overline: { fontSize: 10, letterSpacing: 0.8, fontWeight: "700", textTransform: "uppercase" },
  input: { borderWidth: 0.5, borderRadius: r.md, padding: 10, fontSize: t.size.sm, marginTop: 6 },
  promptBox: { padding: 12, borderRadius: r.md, borderWidth: 0.5, marginTop: 6, maxHeight: 240 },
  promptText: { fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: "row", gap: s.sm, marginTop: s.md },
  primaryBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: r.md },
  secondaryBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: r.md, borderWidth: 0.5 },
  note: { fontSize: 11, marginTop: s.md, lineHeight: 16 },
});
