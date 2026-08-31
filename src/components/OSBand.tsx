import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, s, r, t } from "@/src/theme";

interface Props {
  phase: number;
  weekNumber: number;
  weekTheme: string;
  weekDone: number;
  weekTotal: number;
  nextBestAction: { title: string; reason: string } | null;
}

export function OSBand({ phase, weekNumber, weekTheme, weekDone, weekTotal, nextBestAction }: Props) {
  const { c } = useTheme();
  const remaining = Math.max(0, weekTotal - weekDone);
  const pct = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0;
  return (
    <View style={[styles.wrap, { backgroundColor: c.surface2, borderColor: c.border }]} testID="os-band">
      <View style={styles.row}>
        <View style={[styles.pill, { backgroundColor: c.surface3, borderColor: c.border }]}>
          <Text style={[styles.pillMono, { color: c.textDim, fontFamily: t.monoFont }]}>P{phase} · W{weekNumber}</Text>
        </View>
        <Text style={[styles.mission, { color: c.text }]} numberOfLines={1}>{weekTheme}</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: c.surface3 }]}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: c.text }]} />
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: c.textFaint, fontFamily: t.monoFont }]}>WEEK · {weekDone}/{weekTotal} DONE · {remaining} REMAINING</Text>
        <Text style={[styles.meta, { color: c.textFaint, fontFamily: t.monoFont }]}>{pct}%</Text>
      </View>
      {nextBestAction ? (
        <View style={[styles.nba, { borderTopColor: c.border }]} testID="next-best-action">
          <Text style={[styles.nbaLabel, { color: c.textFaint, fontFamily: t.monoFont }]}>NEXT BEST ACTION</Text>
          <Text style={[styles.nbaTitle, { color: c.text }]} numberOfLines={2}>{nextBestAction.title}</Text>
          <Text style={[styles.nbaReason, { color: c.textDim }]} numberOfLines={2}>{nextBestAction.reason}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: r.md, borderWidth: 0.5, padding: s.md, marginBottom: s.md },
  row: { flexDirection: "row", alignItems: "center", gap: s.sm },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: r.pill, borderWidth: 0.5 },
  pillMono: { fontSize: 10, letterSpacing: 0.8, fontWeight: "700" },
  mission: { flex: 1, fontSize: t.size.base, fontWeight: "700" },
  progressTrack: { height: 4, borderRadius: 2, marginTop: s.md, overflow: "hidden" },
  progressFill: { height: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  meta: { fontSize: 10, letterSpacing: 0.8, fontWeight: "600" },
  nba: { marginTop: s.md, paddingTop: s.md, borderTopWidth: 0.5 },
  nbaLabel: { fontSize: 10, letterSpacing: 0.8, fontWeight: "700" },
  nbaTitle: { fontSize: t.size.base, fontWeight: "700", marginTop: 4 },
  nbaReason: { fontSize: t.size.sm, marginTop: 2, lineHeight: 19 },
});
