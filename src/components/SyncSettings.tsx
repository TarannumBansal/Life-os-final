import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useTheme, s, r } from "@/src/theme";
import { useSync } from "@/src/sync/useSync";
import { isSyncConfigured } from "@/src/sync/config";

/** Cross-device sync panel for Settings. Self-contained + guarded: if sync isn't configured
 *  (no env keys), it shows a calm note and nothing else. Sign in once per device to link data. */
export function SyncSettings() {
  const { c } = useTheme();
  const { status, label, syncNow, enabled } = useSync();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!isSyncConfigured() || !enabled) {
    return (
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.surface2 }]}>
        <Text style={[styles.title, { color: c.textFaint }]}>CROSS-DEVICE SYNC</Text>
        <Text style={{ color: c.textFaint, fontSize: 12, lineHeight: 18 }}>
          Not configured — LifeOS is running fully local. Add your Supabase keys (see RUNBOOK) to sync across devices.
        </Text>
      </View>
    );
  }

  const signIn = async () => {
    setBusy(true); setMsg(null);
    try {
      const { ensureSignedIn } = await import("@/src/sync/provider.supabase");
      const uid = await ensureSignedIn(email.trim(), password);
      setMsg(uid ? "Linked. Syncing…" : "Signed in.");
      await syncNow();
    } catch (e: any) {
      setMsg(e?.message ? `Couldn't sign in: ${e.message}` : "Couldn't sign in.");
    } finally { setBusy(false); }
  };

  const dot = status === "synced" ? c.success : status === "offline" ? c.textFaint : status === "error" ? c.warning : c.info;

  return (
    <View style={[styles.card, { borderColor: c.border, backgroundColor: c.surface2 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[styles.title, { color: c.textFaint }]}>CROSS-DEVICE SYNC</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
          <Text style={{ color: c.textFaint, fontSize: 11 }}>{label}</Text>
        </View>
      </View>
      <TextInput value={email} onChangeText={setEmail} placeholder="email" placeholderTextColor={c.textFaint}
        autoCapitalize="none" keyboardType="email-address"
        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]} />
      <TextInput value={password} onChangeText={setPassword} placeholder="password" placeholderTextColor={c.textFaint}
        secureTextEntry style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]} />
      <View style={{ flexDirection: "row", gap: s.sm, marginTop: s.sm }}>
        <Pressable onPress={signIn} disabled={busy} style={[styles.btn, { backgroundColor: c.brand, opacity: busy ? 0.6 : 1 }]}>
          <Text style={{ color: c.onBrand, fontWeight: "700", fontSize: 13 }}>{busy ? "…" : "Sign in / link device"}</Text>
        </Pressable>
        <Pressable onPress={syncNow} style={[styles.btn, { borderWidth: 0.5, borderColor: c.border }]}>
          <Text style={{ color: c.textDim, fontWeight: "600", fontSize: 13 }}>Sync now</Text>
        </Pressable>
      </View>
      {msg ? <Text style={{ color: c.textFaint, fontSize: 12, marginTop: s.sm }}>{msg}</Text> : null}
      <Text style={{ color: c.textFaint, fontSize: 11, marginTop: s.sm, lineHeight: 16 }}>
        Use the same email on every device. Data stays private to your account; changes merge automatically and work offline.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 0.5, borderRadius: r.md, padding: s.md, marginBottom: s.lg },
  title: { fontSize: 10, letterSpacing: 0.8, fontWeight: "700", marginBottom: s.sm },
  input: { borderWidth: 0.5, borderRadius: r.sm, paddingHorizontal: 10, paddingVertical: 8, marginTop: s.sm, fontSize: 14 },
  btn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: r.sm, paddingVertical: 10 },
});
