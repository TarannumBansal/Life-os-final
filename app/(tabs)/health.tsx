import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, s, r, t } from "@/src/theme";
import nourish from "@/src/data/nourish.json";
import { useTodayPlan } from "@/src/hooks/useTodayPlan";
import { useRouter } from "expo-router";
import { useSettings } from "@/src/store/settings";
import { lowStock, expiringSoon } from "@/src/engine/pantry";
import { computeShopping } from "@/src/engine/shopping";
import { today } from "@/src/engine/dayOrder";

export default function Health() {
  const { c } = useTheme();
  const { plan } = useTodayPlan();
  const [recipeOpen, setRecipeOpen] = useState<any>(null);
  const router = useRouter();
  const { settings } = useSettings();
  const pantry = settings?.pantry ?? [];
  const shop = computeShopping(pantry);
  const lowN = lowStock(pantry).length;
  const expN = expiringSoon(pantry, today(), 3).length;
  const nDay = ((nourish as any).days as any[])[Math.max(0, (plan?.nourishDay ?? 1) - 1)];

  return (
    <View style={[styles.container, { backgroundColor: c.surface }]} testID="health-screen">
      <SafeAreaView edges={["top"]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Text style={[styles.overline, { color: c.textFaint, fontFamily: t.monoFont }]}>NOURISH · DAY {nDay?.day ?? 1} of {(nourish as any).cycle_length_days}</Text>
          <Text style={[styles.title, { color: c.text }]}>Health</Text>
          <Text style={[styles.sub, { color: c.textDim }]}>{(nourish as any).title}</Text>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: s.lg, paddingBottom: 40 }}>
        <Pressable onPress={() => router.push("/pantry")} testID="open-pantry"
          style={{ borderWidth: 0.5, borderColor: c.border, backgroundColor: c.surface2, borderRadius: r.md, padding: s.md, marginBottom: s.md }}>
          <Text style={{ color: c.textFaint, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 }}>GROCERY & PANTRY</Text>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: "700", marginTop: 2 }}>{shop.totalItems > 0 ? `${shop.totalItems} to buy · ~${shop.estMinutes} min` : "Pantry covers the plan"}</Text>
          <Text style={{ color: (lowN + expN) > 0 ? c.warning : c.textFaint, fontSize: 12, marginTop: 2 }}>{lowN} low · {expN} expiring · tap to open shopping list & inventory →</Text>
        </Pressable>
        {/* Vitals row */}
        <View style={styles.row}>
          <Vital label="HYDRATION" value={`${nDay?.hydration_l ?? 2.8}L`} c={c} />
          <Vital label="STEPS" value={String(nDay?.steps_target ?? 8000)} c={c} />
          <Vital label="SLEEP" value={`${nDay?.sleep_target_h ?? 8}h`} c={c} />
        </View>

        <Text style={[styles.sectionH, { color: c.text }]}>Today's meals</Text>
        {nDay?.meals?.map((m: any) => (
          <View key={m.id} style={[styles.card, { backgroundColor: c.surface2, borderColor: c.border }]} testID={`meal-${m.id}`}>
            <Text style={[styles.mealTime, { color: c.textFaint, fontFamily: t.monoFont }]}>{m.time.toUpperCase()} · {m.label.toUpperCase()}</Text>
            <Text style={[styles.mealText, { color: c.text }]}>{m.text}</Text>
          </View>
        ))}

        <Text style={[styles.sectionH, { color: c.text }]}>Workout</Text>
        <View style={[styles.card, { backgroundColor: c.surface2, borderColor: c.border }]}>
          <Text style={[styles.mealText, { color: c.text }]}>{nDay?.workout}</Text>
        </View>

        <Text style={[styles.sectionH, { color: c.text }]}>Recipes</Text>
        {((nourish as any).recipes as any[]).map((rec) => (
          <Pressable key={rec.id} testID={`recipe-${rec.id}`} onPress={() => setRecipeOpen(rec)} style={[styles.card, { backgroundColor: c.surface2, borderColor: c.border }]}>
            <Text style={[styles.mealTime, { color: c.textFaint, fontFamily: t.monoFont }]}>{rec.time_min} MIN</Text>
            <Text style={[styles.mealText, { color: c.text }]}>{rec.name}</Text>
            <Text style={[styles.sub, { color: c.textFaint, marginTop: 2 }]}>Tap for steps</Text>
          </Pressable>
        ))}

        <Text style={[styles.sectionH, { color: c.text }]}>Principles</Text>
        {((nourish as any).principles as string[]).map((p, i) => (
          <View key={i} style={[styles.card, { backgroundColor: c.surface2, borderColor: c.border, paddingVertical: 12 }]}>
            <Text style={[styles.principle, { color: c.textDim }]}>{p}</Text>
          </View>
        ))}

        <Text style={[styles.sectionH, { color: c.text }]}>Grocery this week</Text>
        <View style={[styles.card, { backgroundColor: c.surface2, borderColor: c.border }]}>
          <Text style={[styles.principle, { color: c.textDim }]}>{((nourish as any).grocery_weekly as string[]).join(" · ")}</Text>
        </View>
      </ScrollView>

      <Modal transparent visible={!!recipeOpen} animationType="fade" onRequestClose={() => setRecipeOpen(null)}>
        <Pressable onPress={() => setRecipeOpen(null)} style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} />
        <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.title, { color: c.text, marginBottom: s.md }]}>{recipeOpen?.name}</Text>
          <Text style={[styles.mealTime, { color: c.textFaint, fontFamily: t.monoFont }]}>INGREDIENTS</Text>
          {recipeOpen?.ingredients?.map((i: string, idx: number) => (
            <Text key={idx} style={[styles.step, { color: c.textDim }]}>• {i}</Text>
          ))}
          <Text style={[styles.mealTime, { color: c.textFaint, fontFamily: t.monoFont, marginTop: s.md }]}>STEPS</Text>
          {recipeOpen?.steps?.map((step: string, idx: number) => (
            <Text key={idx} style={[styles.step, { color: c.textDim }]}>{idx + 1}. {step}</Text>
          ))}
          <Pressable testID="close-recipe" onPress={() => setRecipeOpen(null)} style={[styles.closeBtn, { backgroundColor: c.text }]}>
            <Text style={{ color: c.onBrand, fontWeight: "600" }}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function Vital({ label, value, c }: { label: string; value: string; c: any }) {
  return (
    <View style={[styles.vital, { backgroundColor: c.surface2, borderColor: c.border }]}>
      <Text style={[styles.overline, { color: c.textFaint, fontFamily: t.monoFont }]}>{label}</Text>
      <Text style={[styles.vitalV, { color: c.text, fontFamily: t.monoFont }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: s.lg, paddingBottom: s.md, borderBottomWidth: 0.5 },
  overline: { fontSize: 10, letterSpacing: 0.8, fontWeight: "600" },
  title: { fontSize: t.size.xxl, fontWeight: "800", marginTop: 2, letterSpacing: -0.5 },
  sub: { fontSize: t.size.sm, marginTop: 4 },
  row: { flexDirection: "row", gap: s.md, marginBottom: s.lg },
  vital: { flex: 1, borderRadius: r.md, borderWidth: 0.5, padding: s.md },
  vitalV: { fontSize: t.size.xl, fontWeight: "700", marginTop: 4 },
  sectionH: { fontSize: t.size.md, fontWeight: "700", marginTop: s.xl, marginBottom: s.sm },
  card: { borderRadius: r.md, borderWidth: 0.5, padding: s.md, marginBottom: s.sm },
  mealTime: { fontSize: 10, letterSpacing: 0.8, fontWeight: "600" },
  mealText: { fontSize: t.size.base, fontWeight: "600", marginTop: 4, lineHeight: 22 },
  principle: { fontSize: t.size.sm, lineHeight: 20 },
  sheet: { position: "absolute", left: s.lg, right: s.lg, top: Dimensions.get("window").height / 6, borderRadius: r.lg, borderWidth: 0.5, padding: s.xl, maxHeight: Dimensions.get("window").height * 0.7 },
  step: { fontSize: t.size.sm, marginTop: 4, lineHeight: 20 },
  closeBtn: { marginTop: s.xl, borderRadius: r.md, paddingVertical: 12, alignItems: "center" },
});
