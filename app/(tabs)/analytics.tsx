import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTheme, s, r, domainColor } from "@/src/theme";
import { Container } from "@/src/components/layout/Container";
import { useSettings, currentWeekNumber } from "@/src/store/settings";
import { today } from "@/src/engine/dayOrder";
import * as A from "@/src/engine/analytics";
import { weeklyInsights } from "@/src/engine/coaching";
import { growthStory } from "@/src/engine/story";

/** Growth Analytics — visualises growth (execution, mastery, evidence, consistency,
 *  phase/domain progress, velocity) + weekly coaching insights. */
export default function Analytics() {
  const { c, mode } = useTheme();
  const { settings } = useSettings();
  if (!settings) return <Loading />;

  const currentWeek = currentWeekNumber(settings.roadmapStartDate);
  const input: A.AnalyticsInput = {
    roadmapStartDate: settings.roadmapStartDate,
    todayISO: today(),
    currentWeek,
    itemProgress: settings.itemProgress,
    completions: settings.completions,
    mastery: settings.mastery,
    evidence: settings.evidence,
    feedbackLog: settings.feedbackLog,
  };
  const sum = A.analyticsSummary(input);
  const weekly = A.weeklyExecution(input);
  const phases = A.phaseProgress(input);
  const domains = A.domainProgress(input);
  const insights = weeklyInsights(input);
  const story = growthStory(settings.evidence, settings.mastery);

  return (
    <View style={[styles.root, { backgroundColor: c.surface }]} testID="analytics-screen">
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <SafeAreaView edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: s.lg, paddingBottom: 60 }}>
          <Container>
            <Text style={[styles.kicker, { color: c.textFaint }]}>GROWTH ANALYTICS</Text>
            <Text style={[styles.h1, { color: c.text }]}>Week {currentWeek} · Phase {sum.phase}</Text>

            {/* headline stats */}
            <View style={styles.statRow}>
              <Stat c={c} label="This week" value={`${sum.thisWeekExecution}%`} sub="execution" />
              <Stat c={c} label="Mastery" value={`${sum.mastery.overall}%`} sub="competencies" />
              <Stat c={c} label="Evidence" value={`${sum.evidence.total}`} sub="artefacts" />
            </View>
            <View style={styles.statRow}>
              <Stat c={c} label="Consistency" value={`${sum.consistency.activeDays}/${sum.consistency.windowDays}`} sub="active days" />
              <Stat c={c} label="Velocity" value={`${sum.velocity}`} sub="contrib/wk" />
              <Stat c={c} label="AI reviews" value={`${sum.feedbackCount}`} sub="logged" />
            </View>

            <Section c={c} title="Weekly execution">
              {weekly.map((w) => <Bar key={w.week} c={c} label={`W${w.week}`} pct={w.pct} color={c.text} />)}
            </Section>

            <Section c={c} title="Phase progress">
              {phases.map((p) => <Bar key={p.phase} c={c} label={`Phase ${p.phase}`} pct={p.pct} color={c.text} />)}
            </Section>

            <Section c={c} title="Domain execution (this week)">
              {domains.filter((d) => d.pct > 0 || true).map((d) => (
                <Bar key={d.domain} c={c} label={d.label} pct={d.pct} color={domainColor(d.domain, mode)} />
              ))}
            </Section>

            <Section c={c} title="Mastery by domain">
              {sum.mastery.byDomain.map((d) => (
                <Bar key={d.domain} c={c} label={d.label} pct={d.pct} color={domainColor(d.domain, mode)} />
              ))}
            </Section>

            <Section c={c} title="Your growth story">
              {story.map((m, i) => (
                <View key={m.key} style={{ flexDirection: "row", alignItems: "flex-start", gap: s.sm, marginBottom: s.sm }}>
                  <View style={{ alignItems: "center" }}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: m.achieved ? c.success : c.border, backgroundColor: m.achieved ? c.success : "transparent" }} />
                    {i < story.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 16, backgroundColor: c.border, marginTop: 2 }} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 2 }}>
                    <Text style={{ color: m.achieved ? c.text : c.textFaint, fontSize: 13, fontWeight: m.achieved ? "700" : "500" }}>{m.label}</Text>
                    <Text style={{ color: c.textFaint, fontSize: 11 }}>{m.achieved ? "Achieved" : m.hint}</Text>
                  </View>
                </View>
              ))}
            </Section>

            <Section c={c} title="This week's insights">
              {insights.length === 0
                ? <Text style={{ color: c.textFaint, fontSize: 13 }}>Keep logging — insights appear as data accumulates.</Text>
                : insights.map((i, idx) => (
                  <View key={idx} style={[styles.insight, { borderColor: c.border, backgroundColor: c.surface2 }]}>
                    <Text style={{ color: i.tone === "positive" ? c.success : i.tone === "watch" ? c.warning : c.textDim, fontSize: 13, lineHeight: 19 }}>{i.text}</Text>
                  </View>
                ))}
            </Section>
          </Container>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ c, label, value, sub }: any) {
  return (
    <View style={[styles.stat, { borderColor: c.border, backgroundColor: c.surface2 }]}>
      <Text style={{ color: c.textFaint, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: "800", marginTop: 2 }}>{value}</Text>
      <Text style={{ color: c.textFaint, fontSize: 11 }}>{sub}</Text>
    </View>
  );
}
function Section({ c, title, children }: any) {
  return (
    <View style={{ marginTop: s.xl }}>
      <Text style={{ color: c.textFaint, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: s.sm }}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}
function Bar({ c, label, pct, color }: any) {
  return (
    <View style={{ marginBottom: s.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
        <Text style={{ color: c.textDim, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: c.textFaint, fontSize: 12 }}>{pct}%</Text>
      </View>
      <View style={{ height: 8, borderRadius: r.sm, backgroundColor: c.surface3, overflow: "hidden" }}>
        <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", backgroundColor: color, borderRadius: r.sm }} />
      </View>
    </View>
  );
}
function Loading() {
  const { c } = useTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}><Text style={{ color: c.textDim, padding: 24 }}>Loading analytics…</Text></SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  h1: { fontSize: 26, fontWeight: "800", marginTop: 2, marginBottom: s.lg },
  statRow: { flexDirection: "row", gap: s.sm, marginBottom: s.sm },
  stat: { flex: 1, borderWidth: 0.5, borderRadius: r.md, padding: s.md },
  insight: { borderWidth: 0.5, borderRadius: r.md, padding: s.md, marginBottom: s.sm },
});
