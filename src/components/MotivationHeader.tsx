import React from "react";
import { View, Text } from "react-native";
import { useTheme, s, r } from "@/src/theme";
import { motivationFor, Moment } from "@/src/engine/motivation";

/** Subtle ritual message + contextual quote. Supporting content — never competes with the plan. */
export function MotivationHeader({ dateISO, moment, state }: { dateISO: string; moment: Moment; state: any }) {
  const { c } = useTheme();
  const m = motivationFor(moment, state, dateISO);
  const lines = m.stable.split(/(?<=\.)\s+/);
  return (
    <View style={{ marginBottom: s.md }} testID="motivation-header">
      {lines.map((ln, i) => (
        <Text key={i} style={{ color: i === 0 ? c.text : c.textDim, fontSize: i === 0 ? 17 : 13, fontWeight: i === 0 ? "800" : "400", lineHeight: i === 0 ? 24 : 20, letterSpacing: i === 0 ? -0.3 : 0 }}>{ln}</Text>
      ))}
      <View style={{ marginTop: s.md, paddingLeft: s.md, borderLeftWidth: 2, borderLeftColor: c.border }}>
        <Text style={{ color: c.textDim, fontSize: 13, fontStyle: "italic", lineHeight: 19 }}>{m.quote.text}</Text>
        {m.quote.author ? <Text style={{ color: c.textFaint, fontSize: 12, marginTop: 2 }}>— {m.quote.author}</Text> : null}
      </View>
    </View>
  );
}
