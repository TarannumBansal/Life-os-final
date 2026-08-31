import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, s, r, t } from "@/src/theme";
import { useSettings } from "@/src/store/settings";
import { deriveDay, today } from "@/src/engine/dayOrder";
import { scheduleBlocksForDate } from "@/src/engine/schedule";
import { buildTimeline, FixedBlock, FlexTask } from "@/src/engine/timeline";
import type { DayPlan } from "@/src/engine/planner";
import type { FrozenTask } from "@/src/engine/freeze";
import nourish from "@/src/data/nourish.json";

const N: any = nourish;
const HHMM = (tt?: string) => (tt && /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.test(tt)) ? norm(tt) : undefined;
function norm(tt: string): string {
  const m = tt.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i); if (!m) return tt;
  let h = parseInt(m[1]); const min = m[2]; const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12; if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}
const toMin = (x: string) => { const [h, m] = x.split(":").map(Number); return h * 60 + m; };
function pretty(hhmm: string): string { // 24h -> "8:00", "5:15p"
  const [h, m] = hhmm.split(":").map(Number); const ap = h >= 12 ? "p" : "a"; const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")}${ap}`;
}

/** ONE coherent daily timeline — a colored spine showing what's now, next and already passed.
 *  Approximate anchors, not deadlines. Consumes the finite frozen task set only. */
export function DailyTimeline({ plan, tasks: frozenTasks }: { plan: DayPlan; tasks: FrozenTask[] }) {
  const { c, mode } = useTheme();
  const { settings } = useSettings();
  if (!settings) return null;
  const date = today();
  const day = deriveDay(date, settings.dayOrderConfig);

  const fixed: FixedBlock[] = [];
  for (const cl of day.classes) fixed.push({ start: cl.start, end: cl.end, label: "College", kind: "class" });
  for (const b of scheduleBlocksForDate(settings.scheduleLogs, date)) fixed.push({ start: b.start, end: b.end, label: b.title, kind: "fixed" });
  const nDay = (N.days as any[])[Math.max(0, (plan.nourishDay ?? 1) - 1)];
  for (const meal of nDay?.meals ?? []) { const tm = HHMM(meal.time); if (tm) fixed.push({ start: tm, end: addMin(tm, 25), label: meal.label, kind: "meal" }); }

  const tasks: FlexTask[] = frozenTasks.map((tk) => ({ id: tk.id, label: tk.title, durationMin: tk.durationMin }));
  const completedIds = new Set(settings.completions.filter((x) => x.date === date).map((x) => x.taskId));
  const tl = buildTimeline({ dateISO: date, fixed, tasks, completedTaskIds: [...completedIds] });

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const accent = (k: string) => k === "class" ? c.info : k === "fixed" ? c.warning : k === "meal" ? c.success : k === "sleep" ? c.textFaint : c.text;

  // find the first item whose window contains "now" → the current focus
  let currentIdx = -1;
  tl.items.forEach((it, i) => { if (currentIdx === -1 && toMin(it.start) <= nowMin && (it.end === it.start ? nowMin < toMin(it.start) + 30 : nowMin < toMin(it.end))) currentIdx = i; });

  return (
    <View style={[styles.card, { borderColor: c.border, backgroundColor: c.surface2 }]} testID="daily-timeline">
      <Text style={[styles.sub, { color: c.textFaint }]}>Approximate — start when you can. Fixed commitments are locked.</Text>
      {tl.items.map((it, i) => {
        const isTask = it.kind === "deep";
        const done = isTask && it.taskId ? completedIds.has(it.taskId) : false;
        const past = it.end !== it.start ? toMin(it.end) <= nowMin : toMin(it.start) + 30 <= nowMin;
        const current = i === currentIdx;
        const dim = (past && !current) || it.kind === "buffer";
        const col = accent(it.kind);
        return (
          <View key={i} style={[styles.row, current && { backgroundColor: c.surface3, borderRadius: r.sm }]}>
            <Text style={[styles.time, { color: current ? c.text : c.textFaint, fontFamily: t.monoFont, opacity: dim ? 0.5 : 1 }]}>
              {pretty(it.start)}{it.end !== it.start ? `–${pretty(it.end)}` : ""}
            </Text>
            <View style={[styles.spine, { backgroundColor: current ? col : done ? c.success : col, opacity: dim ? 0.35 : 1 }]} />
            <View style={{ flex: 1, opacity: dim ? 0.55 : 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: it.fixed ? "700" : "500", textDecorationLine: done ? "line-through" : "none" }}>
                  {it.label}
                </Text>
                {it.fixed ? <Text style={[styles.tag, { color: c.warning, borderColor: c.warning }]}>FIXED</Text> : null}
                {current ? <Text style={[styles.tag, { color: c.onBrand, backgroundColor: c.text, borderColor: c.text }]}>NOW</Text> : null}
                {done ? <Text style={{ color: c.success, fontSize: 12 }}>✓</Text> : null}
              </View>
            </View>
          </View>
        );
      })}
      {tl.deferred.length > 0 && (
        <Text style={{ color: c.textFaint, fontSize: 12, marginTop: s.sm, lineHeight: 18 }}>
          {tl.deferred.length} lower-priority item{tl.deferred.length > 1 ? "s" : ""} won't fit today — carried forward calmly. Sleep is protected.
        </Text>
      )}
      {tl.todayComplete && <Text style={{ color: c.success, fontSize: 13, fontWeight: "700", marginTop: s.sm }}>Today's plan complete ✓</Text>}
    </View>
  );
}
function addMin(tt: string, m: number): string { const [h, mm] = tt.split(":").map(Number); const tot = h * 60 + mm + m; return `${String(Math.floor(tot / 60)).padStart(2, "0")}:${String(tot % 60).padStart(2, "0")}`; }

const styles = StyleSheet.create({
  card: { borderWidth: 0.5, borderRadius: r.md, padding: s.md, marginBottom: s.md },
  sub: { fontSize: 11, marginBottom: s.sm, lineHeight: 16 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 4 },
  time: { width: 92, fontSize: 11 },
  spine: { width: 3, alignSelf: "stretch", borderRadius: 2, marginRight: 10, marginLeft: 2 },
  tag: { fontSize: 8.5, fontWeight: "800", letterSpacing: 0.5, borderWidth: 0.5, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, overflow: "hidden" },
});
