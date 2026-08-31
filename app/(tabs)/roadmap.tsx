import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, s, r, t, domainColor } from "@/src/theme";
import pgos from "@/src/data/pgos.json";
import { useSettings, currentWeekNumber } from "@/src/store/settings";

const WEEKS = (pgos as any).WEEKS as any[];
const PHASES = (pgos as any).PHASES as any[];
const DOMAINS = (pgos as any).DOMAINS as any[];

export default function Roadmap() {
  const { c, mode } = useTheme();
  const { settings } = useSettings();
  const currentWeek = settings ? currentWeekNumber(settings.roadmapStartDate) : 1;
  const [expandedWeek, setExpandedWeek] = useState<number | null>(currentWeek);

  return (
    <View style={[styles.container, { backgroundColor: c.surface }]} testID="roadmap-screen">
      <SafeAreaView edges={["top"]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Text style={[styles.overline, { color: c.textFaint, fontFamily: t.monoFont }]}>32-WEEK BLUEPRINT</Text>
          <Text style={[styles.title, { color: c.text }]}>PGOS Roadmap</Text>
          <Text style={[styles.sub, { color: c.textDim }]}>Learn → Build → Document → Share → Reflect → Improve</Text>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: s.lg, paddingBottom: 40 }}>
        {PHASES.map((phase) => (
          <View key={phase.id} style={{ marginBottom: s.xl }}>
            <Text style={[styles.phaseLabel, { color: c.textFaint, fontFamily: t.monoFont }]}>PHASE {phase.id} · W{phase.weeks}</Text>
            <Text style={[styles.phaseTitle, { color: c.text }]}>{phase.title}</Text>
            {WEEKS.filter((w) => w.phase === phase.id).map((w) => {
              const isCurrent = w.week === currentWeek;
              const isExpanded = expandedWeek === w.week;
              return (
                <Pressable
                  key={w.week}
                  testID={`week-card-${w.week}`}
                  onPress={() => setExpandedWeek(isExpanded ? null : w.week)}
                  style={[styles.weekCard, { backgroundColor: c.surface2, borderColor: isCurrent ? c.text : c.border, borderWidth: isCurrent ? 1 : 0.5 }]}
                >
                  <View style={styles.weekRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.weekNum, { color: c.textFaint, fontFamily: t.monoFont }]}>WEEK {w.week}{isCurrent ? " · NOW" : ""}</Text>
                      <Text style={[styles.weekTheme, { color: c.text }]}>{w.theme}</Text>
                    </View>
                  </View>
                  {isExpanded && (
                    <View style={{ marginTop: s.md }}>
                      {w.objectives && (
                        <Section title="Objectives" body={Array.isArray(w.objectives) ? w.objectives.join(" · ") : String(w.objectives)} c={c} />
                      )}
                      {w.tech?.project && <Section title="Project" body={String(w.tech.project)} c={c} />}
                      {w.dsa && <Section title="DSA" body={typeof w.dsa === "string" ? w.dsa : JSON.stringify(w.dsa)} c={c} />}
                      {w.health && <Section title="Health" body={typeof w.health === "string" ? w.health : JSON.stringify(w.health)} c={c} />}
                      {w.reflection && <Section title="Reflection" body={typeof w.reflection === "string" ? w.reflection : JSON.stringify(w.reflection)} c={c} />}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={{ marginTop: s.xl }}>
          <Text style={[styles.overline, { color: c.textFaint, fontFamily: t.monoFont, marginBottom: s.sm }]}>9 DOMAINS</Text>
          <View style={styles.domainGrid}>
            {DOMAINS.map((d) => (
              <View key={d.id} style={[styles.domainChip, { backgroundColor: c.surface2, borderColor: c.border }]}>
                <View style={[styles.domainDot, { backgroundColor: domainColor(d.id, mode) }]} />
                <Text style={[styles.domainLabel, { color: c.text }]}>{String(d.label).replace(/[^A-Za-z\s&]/g, "").trim()}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, body, c }: { title: string; body: string; c: any }) {
  return (
    <View style={{ marginTop: s.sm }}>
      <Text style={[styles.sectionLabel, { color: c.textFaint, fontFamily: t.monoFont }]}>{title.toUpperCase()}</Text>
      <Text style={[styles.sectionBody, { color: c.textDim }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: s.lg, paddingBottom: s.md, borderBottomWidth: 0.5 },
  overline: { fontSize: 10, letterSpacing: 0.8, fontWeight: "600" },
  title: { fontSize: t.size.xxl, fontWeight: "800", marginTop: 2, letterSpacing: -0.5 },
  sub: { fontSize: t.size.sm, marginTop: 4 },
  phaseLabel: { fontSize: 10, letterSpacing: 0.8, fontWeight: "600", marginTop: s.md },
  phaseTitle: { fontSize: t.size.lg, fontWeight: "700", marginBottom: s.md, marginTop: 2 },
  weekCard: { borderRadius: r.md, padding: s.md, marginBottom: s.sm },
  weekRow: { flexDirection: "row" },
  weekNum: { fontSize: 10, letterSpacing: 0.8, fontWeight: "600" },
  weekTheme: { fontSize: t.size.base, fontWeight: "600", marginTop: 2 },
  sectionLabel: { fontSize: 10, letterSpacing: 0.8, fontWeight: "600" },
  sectionBody: { fontSize: t.size.sm, marginTop: 4, lineHeight: 20 },
  domainGrid: { flexDirection: "row", flexWrap: "wrap", gap: s.sm },
  domainChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: r.pill, borderWidth: 0.5 },
  domainDot: { width: 8, height: 8, borderRadius: 4 },
  domainLabel: { fontSize: t.size.sm, fontWeight: "600" },
});
