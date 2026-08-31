import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, s, r, t } from "@/src/theme";
import { DayModeHeader } from "@/src/components/DayModeHeader";
import { BlockCard } from "@/src/components/BlockCard";
import { OSBand } from "@/src/components/OSBand";
import { MissionControl } from "@/src/components/MissionControl";
import { MotivationHeader } from "@/src/components/MotivationHeader";
import { TodayHero } from "@/src/components/TodayHero";
import { Container } from "@/src/components/layout/Container";
import { TomorrowSection } from "@/src/components/TomorrowSection";
import { DailyTimeline } from "@/src/components/DailyTimeline";
import { ReviewSheet } from "@/src/components/ReviewSheet";
import { useTodayPlan } from "@/src/hooks/useTodayPlan";
import type { Block, Task } from "@/src/engine/planner";
import type { Rationale } from "@/src/engine/rationale";

export default function Today() {
  const { c, mode } = useTheme();
  const { plan, settings, todayTasks, todayDone, todayTotal, todayComplete, todayPct, setMode, toggleTask, isDone } = useTodayPlan();
  const router = useRouter();
  const [whyOpen, setWhyOpen] = useState<{ block?: Block; task?: Task } | null>(null);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);

  if (!plan) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.surface }]}>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <Text style={{ color: c.textDim, padding: 24 }}>Loading Today…</Text>
      </SafeAreaView>
    );
  }

  // FINITE Today: render the frozen assigned tasks, grouped into display blocks. Completing a
  // task toggles completion only — it never re-derives or grows this list.
  const frozenBlocks = React.useMemo(() => {
    const byBlock: Record<string, any> = {};
    for (const t of todayTasks) {
      const b = (byBlock[t.blockId] ||= { id: t.blockId, type: t.blockType, label: t.blockLabel, durationMin: 0, rationale: "", tasks: [] });
      b.durationMin += t.durationMin;
      b.tasks.push({ id: t.id, weekItemId: t.weekItemId, domain: t.domain, title: t.title, durationMin: t.durationMin, detail: t.detail, expectedOutput: t.expectedOutput, reviewable: t.reviewable, reviewKind: t.reviewKind, rationale: { line: t.rationaleLine || "" } });
    }
    return Object.values(byBlock);
  }, [todayTasks]);
  const completed = todayDone;
  const total = todayTotal;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <View style={[styles.container, { backgroundColor: c.surface }]} testID="today-screen">
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <SafeAreaView edges={["top"]}>
        <DayModeHeader
          mode={plan.mode}
          onChange={setMode}
          freeMinutes={plan.totalFreeMinutes}
          weekNumber={plan.weekNumber}
          weekTheme={plan.weekTheme}
          onWhy={() => setWhyOpen({})}
        />
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: s.lg, paddingBottom: s.huge }} showsVerticalScrollIndicator={false}>
        <Container>
        <MotivationHeader
          dateISO={new Date().toISOString().slice(0, 10)}
          moment={(() => { const h = new Date().getHours(); return todayComplete ? "completion" : h < 12 ? "morning" : "afternoon"; })()}
          state={{ isFirstDay: plan.weekNumber === 1, isNewWeek: false, isFlex: plan.flags.isFlex, isExam: plan.flags.isExam, weekExecutionPct: todayPct, todayComplete }}
        />

        <TodayHero done={completed} total={total} complete={todayComplete} nextTitle={plan.nextBestAction?.title} nextReason={plan.nextBestAction?.reason} />

        {plan.flags.isFlex ? (
          <View style={[styles.notice, { backgroundColor: c.surface2, borderColor: c.border }]}>
            <Text style={[styles.noticeText, { color: c.textDim }]}>Flex Day — planned freedom, not failure. LifeOS will rebalance tomorrow.</Text>
          </View>
        ) : null}
        {plan.flags.isSunday ? (
          <View style={[styles.notice, { backgroundColor: c.surface2, borderColor: c.border }]}>
            <Text style={[styles.noticeText, { color: c.textDim }]}>Sunday · lighter execution + weekly review + meal prep.</Text>
          </View>
        ) : null}

        <Section label="YOUR DAY" c={c} />
        <DailyTimeline plan={plan} tasks={todayTasks} />

        <Section label="TODAY'S TASKS" c={c} />
        {frozenBlocks.length === 0 ? (
          <Text style={{ color: c.textFaint, fontSize: 13, marginBottom: s.lg }}>No tasks scheduled today — enjoy the space.</Text>
        ) : frozenBlocks.map((b: any) => (
          <BlockCard
            key={b.id}
            block={b}
            isDone={isDone}
            onToggle={toggleTask}
            onWhy={(block, task) => setWhyOpen({ block, task })}
            onReview={(task) => setReviewTask(task)}
          />
        ))}

        <TomorrowSection />

        <Section label="THIS WEEK" c={c} />
        <OSBand
          phase={plan.phase}
          weekNumber={plan.weekNumber}
          weekTheme={plan.weekTheme}
          weekDone={plan.weekDone}
          weekTotal={plan.weekTotal}
          nextBestAction={plan.nextBestAction ? { title: plan.nextBestAction.title, reason: plan.nextBestAction.reason } : null}
        />
        {settings ? <MissionControl settings={settings} weekNumber={plan.weekNumber} /> : null}

        <View style={[styles.summaryRow, { marginTop: s.lg }]}>
          <View style={[styles.summaryCard, { backgroundColor: c.surface2, borderColor: c.border }]}>
            <Text style={[styles.summaryLabel, { color: c.textFaint, fontFamily: t.monoFont }]}>NOURISH</Text>
            <Text style={[styles.summaryValue, { color: c.text, fontFamily: t.monoFont }]}>Day {plan.nourishDay}</Text>
            <Text style={[styles.summarySub, { color: c.textDim }]}>rotating cycle</Text>
          </View>
          <Pressable testID="settings-button" onPress={() => router.push("/settings")} style={[styles.summaryCard, { backgroundColor: c.surface2, borderColor: c.border, alignItems: "center", justifyContent: "center" }]}>
            <Feather name="settings" size={20} color={c.textDim} />
            <Text style={[styles.summarySub, { color: c.textDim, marginTop: 4 }]}>Settings</Text>
          </Pressable>
        </View>
        </Container>
      </ScrollView>

      {/* Why-this-plan modal */}
      <Modal transparent visible={!!whyOpen} animationType="fade" onRequestClose={() => setWhyOpen(null)}>
        <Pressable onPress={() => setWhyOpen(null)} style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} testID="why-modal-scrim" />
        <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]} testID="why-modal">
          <Text style={[styles.sheetTitle, { color: c.text }]}>Why this plan?</Text>
          {whyOpen?.task ? (
            <ScrollView>
              <SheetLine label="TASK" body={whyOpen.task.title} c={c} />
              {isRationale(whyOpen.task.rationale) ? (
                <>
                  <SheetLine label="WHY TODAY" body={whyOpen.task.rationale.whyToday} c={c} />
                  <SheetLine label="WHY THIS ORDER" body={whyOpen.task.rationale.whyThisOrder} c={c} />
                  <SheetLine label="WHY THIS DURATION" body={whyOpen.task.rationale.whyThisDuration} c={c} />
                  <SheetLine label="WHICH WEEK OBJECTIVE" body={whyOpen.task.rationale.whichObjective} c={c} />
                  <SheetLine label="IF YOU SKIP" body={whyOpen.task.rationale.ifSkipped} c={c} />
                </>
              ) : (
                <SheetLine label="RATIONALE" body={(whyOpen.task.rationale as any).line} c={c} />
              )}
              {whyOpen.task.expectedOutput ? <SheetLine label="EXPECTED OUTPUT" body={whyOpen.task.expectedOutput} c={c} /> : null}
            </ScrollView>
          ) : (
            <ScrollView>
              <SheetLine label="MISSION" body={`Phase ${plan.phase} · Week ${plan.weekNumber} — "${plan.weekTheme}"`} c={c} />
              <SheetLine label="WEEK PROGRESS" body={`${plan.weekDone}/${plan.weekTotal} contributions complete · ${plan.weekTotal - plan.weekDone} remaining.`} c={c} />
              <SheetLine label="DAY MODE" body={`${plan.mode.toUpperCase()} · ${Math.round(plan.totalFreeMinutes / 60)}h free after classes.`} c={c} />
              <SheetLine label="NEXT BEST ACTION" body={plan.nextBestAction ? `${plan.nextBestAction.title} — ${plan.nextBestAction.reason}` : "All week items complete or no items scheduled."} c={c} />
              <SheetLine label="PRINCIPLES APPLIED" body={"• Habits protected first (never miss twice)\n• Deep work at cognitive peak\n• Weekly deliverables land on lower-class days\n• Consistency over intensity"} c={c} />
            </ScrollView>
          )}
          <Pressable testID="close-why-modal" onPress={() => setWhyOpen(null)} style={[styles.closeBtn, { backgroundColor: c.text }]}>
            <Text style={{ color: c.onBrand, fontWeight: "600" }}>Got it</Text>
          </Pressable>
        </View>
      </Modal>

      <ReviewSheet task={reviewTask} onClose={() => setReviewTask(null)} />
    </View>
  );
}

function isRationale(r: any): r is Rationale {
  return r && typeof r === "object" && "whyToday" in r;
}

function SheetLine({ label, body, c }: { label: string; body: string; c: any }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: c.textFaint, fontFamily: t.monoFont, fontSize: 10, letterSpacing: 0.8, fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: t.size.sm, lineHeight: 20 }}>{body}</Text>
    </View>
  );
}

function Section({ label, c }: { label: string; c: any }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: s.xl, marginBottom: s.sm }}>
      <Text style={{ color: c.textFaint, fontSize: 11, letterSpacing: 1.2, fontWeight: "700", fontFamily: t.monoFont }}>{label}</Text>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: s.sm }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryRow: { flexDirection: "row", gap: s.md, marginBottom: s.lg },
  summaryCard: { flex: 1, borderRadius: r.md, borderWidth: 0.5, padding: s.md },
  summaryLabel: { fontSize: 10, letterSpacing: 0.8, fontWeight: "600" },
  summaryValue: { fontSize: t.size.xl, fontWeight: "700", marginTop: 4 },
  summarySub: { fontSize: t.size.xs, marginTop: 2 },
  notice: { padding: s.md, borderRadius: r.md, borderWidth: 0.5, marginBottom: s.md },
  noticeText: { fontSize: t.size.sm, lineHeight: 20 },
  sheet: { position: "absolute", left: s.lg, right: s.lg, top: 60, bottom: 60, borderRadius: r.lg, borderWidth: 0.5, padding: s.xl },
  sheetTitle: { fontSize: t.size.lg, fontWeight: "700", marginBottom: s.md },
  closeBtn: { marginTop: s.md, borderRadius: r.md, paddingVertical: 12, alignItems: "center" },
});
