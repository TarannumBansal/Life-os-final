import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme, s, r, t } from "@/src/theme";
import { Container } from "@/src/components/layout/Container";
import { useSettings } from "@/src/store/settings";
import { today } from "@/src/engine/dayOrder";
import { buildCatalogue, lowStock, expiringSoon } from "@/src/engine/pantry";
import { depleteForRecipe } from "@/src/engine/pantry";
import { computeShopping, shoppingSchedule, shoppingCheckId, ShoppingRun } from "@/src/engine/shopping";
import { setPantryItem, replacePantry, toggleShoppingCheck } from "@/src/store/repositories";
import nourish from "@/src/data/nourish.json";

const N: any = nourish;

/** Grocery & Pantry — the Nourish pantry/inventory + shopping system.
 *  Answers: buy in next few days? this week? staples low? monthly? already have? expiring? */
export default function Pantry() {
  const { c, mode } = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<"shopping" | "pantry">("shopping");
  if (!settings) return <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}><Text style={{ color: c.textDim, padding: 24 }}>Loading…</Text></SafeAreaView>;

  const catalogue = useMemo(() => buildCatalogue(), []);
  const list = useMemo(() => computeShopping(settings.pantry), [settings.pantry]);
  const sched = shoppingSchedule(today());
  const low = lowStock(settings.pantry);
  const expiring = expiringSoon(settings.pantry, today(), 3);
  const date = today();

  const checkedKey = (run: ShoppingRun, key: string) =>
    settings.shoppingChecks.find((x) => shoppingCheckId(x) === shoppingCheckId({ run, date, key }))?.done ?? false;
  const toggle = (run: ShoppingRun, key: string) => update((st) => toggleShoppingCheck(st, key, run, date, !checkedKey(run, key)));
  const stockOf = (key: string) => settings.pantry.find((p) => p.key === key)?.currentQty ?? 0;
  const setStock = (key: string, qty: number, unit?: string) => update((st) => setPantryItem(st, { key, currentQty: Math.max(0, qty), unit }));
  const cook = (recipeId: string) => update((st) => replacePantry(st, depleteForRecipe(st.pantry, recipeId).inventory));

  return (
    <View style={[styles.root, { backgroundColor: c.surface }]} testID="pantry-screen">
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <SafeAreaView edges={["top"]}>
        <View style={styles.head}>
          <Pressable onPress={() => router.back()} hitSlop={10}><Feather name="chevron-left" size={24} color={c.textDim} /></Pressable>
          <Text style={[styles.title, { color: c.text }]}>Grocery & Pantry</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: s.lg, paddingBottom: 60 }}>
          <Container>
            {/* warnings */}
            {(low.length > 0 || expiring.length > 0) && (
              <View style={[styles.warn, { borderColor: c.border, backgroundColor: c.surface2 }]}>
                {low.length > 0 && <Text style={{ color: c.warning, fontSize: 12, marginBottom: 2 }}>⚠ {low.length} running low: {low.map((i) => i.key).join(", ")}</Text>}
                {expiring.length > 0 && <Text style={{ color: c.error, fontSize: 12 }}>⏳ {expiring.length} expiring soon: {expiring.map((i) => i.key).join(", ")}</Text>}
              </View>
            )}

            <View style={styles.tabs}>
              {(["shopping", "pantry"] as const).map((tb) => (
                <Pressable key={tb} onPress={() => setTab(tb)} style={[styles.tab, { borderColor: c.border, backgroundColor: tab === tb ? c.text : "transparent" }]}>
                  <Text style={{ color: tab === tb ? c.surface : c.textDim, fontWeight: "700", fontSize: 13, textTransform: "capitalize" }}>{tb}</Text>
                </Pressable>
              ))}
            </View>

            {tab === "shopping" ? (
              <>
                <Text style={[styles.help, { color: c.textFaint }]}>
                  {sched.weeklyDue ? "Weekly grocery run is due today (Sunday)." : `Weekly run: ${sched.weeklyRunDay}.`}
                  {sched.monthlyDue ? " Monthly staples run due today." : ""} · ~{list.estMinutes} min{list.estTotalCost != null ? ` · est ${list.estTotalCost}` : ""}
                </Text>
                <RunSection c={c} title="Next 2–3 days (perishables)" lines={list.next} run="next" checked={checkedKey} toggle={toggle} />
                <RunSection c={c} title="This week's grocery run" lines={list.weekly} run="weekly" checked={checkedKey} toggle={toggle} />
                <RunSection c={c} title="Monthly staples run" lines={list.monthly} run="monthly" checked={checkedKey} toggle={toggle} />
                {list.totalItems === 0 && <Text style={{ color: c.textFaint, fontSize: 13, marginTop: s.md }}>Nothing to buy — pantry covers the plan.</Text>}
              </>
            ) : (
              <>
                <Text style={[styles.help, { color: c.textFaint }]}>What you already have. Tap ± to correct quantities (real amounts are approximate). "Cooked" depletes stock per the recipe.</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s.xs, marginBottom: s.md }}>
                  {(N.recipes ?? []).map((rc: any) => (
                    <Pressable key={rc.id} onPress={() => cook(rc.id)} style={[styles.cookBtn, { borderColor: c.border }]}>
                      <Text style={{ color: c.textDim, fontSize: 11 }}>Cooked · {rc.name}</Text>
                    </Pressable>
                  ))}
                </View>
                {catalogue.map((it) => (
                  <View key={it.key} style={[styles.pRow, { borderColor: c.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>{it.name}</Text>
                      <Text style={{ color: c.textFaint, fontSize: 11 }}>{it.category} · pack {it.typicalPackQty}{it.unit}</Text>
                    </View>
                    <Pressable onPress={() => setStock(it.key, stockOf(it.key) - it.typicalPackQty, it.unit)} style={styles.step}><Text style={{ color: c.textDim, fontSize: 18 }}>−</Text></Pressable>
                    <Text style={{ color: c.text, width: 54, textAlign: "center", fontFamily: t.monoFont }}>{stockOf(it.key)}{it.unit}</Text>
                    <Pressable onPress={() => setStock(it.key, stockOf(it.key) + it.typicalPackQty, it.unit)} style={styles.step}><Text style={{ color: c.textDim, fontSize: 18 }}>+</Text></Pressable>
                  </View>
                ))}
              </>
            )}
          </Container>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function RunSection({ c, title, lines, run, checked, toggle }: any) {
  if (!lines.length) return null;
  return (
    <View style={{ marginTop: s.lg }}>
      <Text style={{ color: c.textFaint, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: s.xs }}>{title.toUpperCase()} · {lines.length}</Text>
      {lines.map((l: any) => {
        const on = checked(run, l.key);
        return (
          <Pressable key={l.key} onPress={() => toggle(run, l.key)} style={[styles.line, { borderColor: c.border }]}>
            <View style={[styles.box, { borderColor: on ? c.success : c.border, backgroundColor: on ? c.success : "transparent" }]} />
            <Text style={{ color: on ? c.textFaint : c.text, fontSize: 13, flex: 1, textDecorationLine: on ? "line-through" : "none" }}>{l.name}</Text>
            <Text style={{ color: c.textFaint, fontSize: 12 }}>{l.neededQty}{l.unit} · {l.shop}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: s.lg, paddingVertical: s.sm },
  title: { fontSize: 18, fontWeight: "800" },
  warn: { borderWidth: 0.5, borderRadius: r.md, padding: s.md, marginBottom: s.md },
  tabs: { flexDirection: "row", gap: s.sm, marginBottom: s.sm },
  tab: { flex: 1, alignItems: "center", borderWidth: 0.5, borderRadius: r.pill, paddingVertical: 8 },
  help: { fontSize: 12, lineHeight: 18, marginTop: s.sm, marginBottom: s.sm },
  line: { flexDirection: "row", alignItems: "center", gap: s.sm, borderTopWidth: 0.5, paddingVertical: s.sm },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 2 },
  pRow: { flexDirection: "row", alignItems: "center", gap: s.xs, borderTopWidth: 0.5, paddingVertical: s.sm },
  step: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  cookBtn: { borderWidth: 0.5, borderRadius: r.pill, paddingHorizontal: 10, paddingVertical: 5 },
});
