import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, s, r, t } from "@/src/theme";

/** The hero of Today: answers "what's my day, how far am I, what's next" at a glance.
 *  Token-based, uses the existing design system. Primary counter is TODAY's tasks. */
export function TodayHero({ done, total, complete, nextTitle, nextReason }:
  { done: number; total: number; complete: boolean; nextTitle?: string | null; nextReason?: string | null }) {
  const { c } = useTheme();
  const pct = total ? Math.round((done / total) * 100) : 0;
  const remaining = Math.max(0, total - done);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: c.textFaint, fontFamily: t.monoFont }]}>TODAY</Text>
        {complete
          ? <Text style={{ color: c.success, fontSize: t.size.sm, fontWeight: "700" }}>Complete ✓</Text>
          : <Text style={{ color: c.textFaint, fontSize: t.size.sm }}>{remaining} left</Text>}
      </View>

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={{ color: c.text, fontSize: 40, fontWeight: "800", letterSpacing: -1 }}>{done}</Text>
        <Text style={{ color: c.textFaint, fontSize: 22, fontWeight: "700" }}>/ {total}</Text>
        <Text style={{ color: c.textFaint, fontSize: t.size.sm, marginLeft: "auto" }}>{pct}%</Text>
      </View>

      <View style={{ height: 8, borderRadius: r.pill, backgroundColor: c.surface3, overflow: "hidden", marginTop: s.sm }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: complete ? c.success : c.text, borderRadius: r.pill }} />
      </View>

      {!complete && nextTitle ? (
        <View style={[styles.next, { borderColor: c.border, backgroundColor: c.surface2 }]}>
          <Text style={{ color: c.textFaint, fontSize: 10, fontWeight: "700", letterSpacing: 0.8, fontFamily: t.monoFont }}>NEXT BEST ACTION</Text>
          <Text style={{ color: c.text, fontSize: t.size.base, fontWeight: "700", marginTop: 2 }}>{nextTitle}</Text>
          {nextReason ? <Text style={{ color: c.textDim, fontSize: t.size.sm, marginTop: 2, lineHeight: 19 }}>{nextReason}</Text> : null}
        </View>
      ) : null}
      {complete ? (
        <Text style={{ color: c.textDim, fontSize: t.size.sm, marginTop: s.md, lineHeight: 20 }}>
          Today's plan is done. The week continues tomorrow — rest is part of the work.
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { marginBottom: s.xl },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: s.xs },
  label: { fontSize: 11, letterSpacing: 1.2, fontWeight: "700" },
  next: { marginTop: s.md, borderWidth: 0.5, borderRadius: r.md, padding: s.md },
});
