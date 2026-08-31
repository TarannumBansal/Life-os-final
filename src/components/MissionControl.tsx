import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, s, r, t, domainColor } from "@/src/theme";
import type { LifeOSSettings } from "@/src/store/settings";
import { today } from "@/src/engine/dayOrder";
import * as A from "@/src/engine/analytics";
import { upcomingMilestone, pendingReviews } from "@/src/engine/story";
import { buildWeekItems } from "@/src/engine/weekLedger";

/** Mission Control — the "I know exactly where I am" strip under the OS band on Home.
 *  Domain progress + evidence + pending reviews + consistency + the next milestone.
 *  Pure-render over the verified analytics/story engines. */
export function MissionControl({ settings, weekNumber }: { settings: LifeOSSettings; weekNumber: number }) {
  const { c, mode } = useTheme();

  const input: A.AnalyticsInput = {
    roadmapStartDate: settings.roadmapStartDate, todayISO: today(), currentWeek: weekNumber,
    itemProgress: settings.itemProgress, completions: settings.completions,
    mastery: settings.mastery, evidence: settings.evidence, feedbackLog: settings.feedbackLog,
  };
  const domains = A.domainProgress(input).filter((d) => d.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 3);
  const cons = A.consistency(input);
  const milestone = upcomingMilestone(weekNumber);
  const pending = pendingReviews(buildWeekItems(weekNumber), settings.itemProgress, settings.feedbackLog.length);

  return (
    <View style={[styles.wrap, { backgroundColor: c.surface2, borderColor: c.border }]} testID="mission-control">
      <Text style={[styles.label, { color: c.textFaint, fontFamily: t.monoFont }]}>MISSION CONTROL</Text>

      <View style={styles.chips}>
        <Chip c={c} k="EVIDENCE" v={`${settings.evidence.length}`} />
        <Chip c={c} k="REVIEWS" v={pending > 0 ? `${pending} due` : "clear"} accent={pending > 0 ? c.warning : c.success} />
        <Chip c={c} k="ACTIVE" v={`${cons.activeDays}/${cons.windowDays}d`} />
      </View>

      {domains.length > 0 && (
        <View style={{ marginTop: s.sm }}>
          {domains.map((d) => (
            <View key={d.domain} style={styles.barRow}>
              <Text style={{ color: c.textDim, fontSize: 11, width: 92 }} numberOfLines={1}>{d.label}</Text>
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.surface3, overflow: "hidden" }}>
                <View style={{ width: `${d.pct}%`, height: "100%", backgroundColor: domainColor(d.domain, mode) }} />
              </View>
              <Text style={{ color: c.textFaint, fontSize: 11, width: 34, textAlign: "right" }}>{d.pct}%</Text>
            </View>
          ))}
        </View>
      )}

      {milestone && (
        <View style={[styles.milestone, { borderTopColor: c.border }]}>
          <Text style={[styles.mLabel, { color: c.textFaint, fontFamily: t.monoFont }]}>NEXT MILESTONE · W{milestone.week}</Text>
          <Text style={{ color: c.textDim, fontSize: 12, lineHeight: 18, marginTop: 2 }} numberOfLines={2}>{milestone.milestone}</Text>
        </View>
      )}
    </View>
  );
}

function Chip({ c, k, v, accent }: any) {
  return (
    <View style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface3 }]}>
      <Text style={{ color: c.textFaint, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>{k}</Text>
      <Text style={{ color: accent ?? c.text, fontSize: 14, fontWeight: "800", marginTop: 1 }}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: r.md, borderWidth: 0.5, padding: s.md, marginBottom: s.md },
  label: { fontSize: 10, letterSpacing: 0.8, fontWeight: "700", marginBottom: s.sm },
  chips: { flexDirection: "row", gap: s.sm },
  chip: { flex: 1, borderWidth: 0.5, borderRadius: r.sm, paddingVertical: 6, paddingHorizontal: 8 },
  barRow: { flexDirection: "row", alignItems: "center", gap: s.sm, marginTop: 4 },
  milestone: { marginTop: s.md, paddingTop: s.sm, borderTopWidth: 0.5 },
  mLabel: { fontSize: 9, letterSpacing: 0.8, fontWeight: "700" },
});
