import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTheme, s, r, domainColor } from "@/src/theme";
import { Container } from "@/src/components/layout/Container";
import { useSettings, currentWeekNumber } from "@/src/store/settings";
import { buildWeekItems } from "@/src/engine/weekLedger";
import { competenciesForDomain, getMasteryState, masterySummary, MasteryState } from "@/src/engine/mastery";
import { evidenceForDomain } from "@/src/engine/evidence";
import { setMastery } from "@/src/store/repositories";
import pgos from "@/src/data/pgos.json";

const DOMAINS: any[] = (pgos as any).DOMAINS ?? [];
const NEXT: Record<MasteryState, MasteryState> = { not_demonstrated: "demonstrated", demonstrated: "strong", strong: "not_demonstrated" };
const LABEL: Record<MasteryState, string> = { not_demonstrated: "Not yet", demonstrated: "Demonstrated", strong: "Strong" };

/** Domain Dashboards — each PGOS domain as a workspace: execution, mastery, evidence,
 *  and tappable competency states. */
export default function Domains() {
  const { c, mode } = useTheme();
  const { settings, update } = useSettings();
  const [open, setOpen] = useState<string | null>(null);
  if (!settings) return <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}><Text style={{ color: c.textDim, padding: 24 }}>Loading…</Text></SafeAreaView>;

  const week = currentWeekNumber(settings.roadmapStartDate);
  const items = buildWeekItems(week);

  const cycle = (id: string, domain: string, competency: string, cur: MasteryState) =>
    update((st) => setMastery(st, id, domain, competency, NEXT[cur]));

  return (
    <View style={[styles.root, { backgroundColor: c.surface }]} testID="domains-screen">
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <SafeAreaView edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: s.lg, paddingBottom: 60 }}>
          <Container>
            <Text style={[styles.kicker, { color: c.textFaint }]}>DOMAIN WORKSPACES</Text>
            <Text style={[styles.h1, { color: c.text }]}>9 domains of growth</Text>

            {DOMAINS.map((d) => {
              const col = domainColor(d.id, mode);
              const dItems = items.filter((i) => i.domain === d.id);
              const total = dItems.reduce((a, i) => a + i.targetContributions, 0);
              const done = dItems.reduce((a, i) => a + Math.min(i.targetContributions, settings.itemProgress[i.id] ?? 0), 0);
              const exec = total ? Math.round((done / total) * 100) : 0;
              const mast = masterySummary(settings.mastery, d.id);
              const ev = evidenceForDomain(settings.evidence, d.id).length;
              const comps = competenciesForDomain(d.id);
              const isOpen = open === d.id;

              return (
                <View key={d.id} style={[styles.card, { borderColor: c.border, backgroundColor: c.surface2 }]}>
                  <Pressable onPress={() => setOpen(isOpen ? null : d.id)} style={styles.cardHead}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: s.sm }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: col }} />
                      <Text style={{ color: c.text, fontSize: 15, fontWeight: "700" }}>{d.label}</Text>
                    </View>
                    <Text style={{ color: c.textFaint, fontSize: 12 }}>{isOpen ? "Hide" : "Open"}</Text>
                  </Pressable>

                  <View style={styles.metrics}>
                    <Metric c={c} label="Execution" value={`${exec}%`} />
                    <Metric c={c} label="Mastery" value={`${mast.pct}%`} />
                    <Metric c={c} label="Evidence" value={`${ev}`} />
                  </View>

                  {isOpen && (
                    <View style={{ marginTop: s.md }}>
                      <Text style={{ color: c.textFaint, fontSize: 11, fontWeight: "700", marginBottom: s.xs }}>COMPETENCIES · tap to update</Text>
                      {comps.length === 0 && <Text style={{ color: c.textFaint, fontSize: 12 }}>No competencies declared for this domain.</Text>}
                      {comps.map((comp) => {
                        const state = getMasteryState(settings.mastery, comp.id);
                        const sc = state === "strong" ? c.success : state === "demonstrated" ? c.info : c.textFaint;
                        return (
                          <Pressable key={comp.id} onPress={() => cycle(comp.id, d.id, comp.label, state)}
                            style={[styles.comp, { borderColor: c.border }]}>
                            <Text style={{ color: c.textDim, fontSize: 12, flex: 1, paddingRight: s.sm }} numberOfLines={2}>{comp.label}</Text>
                            <Text style={{ color: sc, fontSize: 11, fontWeight: "700" }}>{LABEL[state]}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </Container>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Metric({ c, label, value }: any) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: c.textFaint, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  h1: { fontSize: 26, fontWeight: "800", marginTop: 2, marginBottom: s.lg },
  card: { borderWidth: 0.5, borderRadius: r.md, padding: s.md, marginBottom: s.md },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metrics: { flexDirection: "row", marginTop: s.md, gap: s.sm },
  comp: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 0.5, paddingVertical: s.sm },
});
