import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { useNavigation } from "@react-navigation/native";
import { generateQrNonce } from "@/services/friends";
import { useSession } from "@/contexts/SessionContext";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

// QR payload is just the nonce; the other phone calls add_friend_via_qr(nonce).
// Keeping it a raw string (not a deep link) makes the app scan anything —
// deep-link handling can come later.

export function QRShareScreen() {
  const nav = useNavigation();
  const { family, user } = useSession();
  const [nonce, setNonce] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setNonce(null);
    generateQrNonce()
      .then(setNonce)
      .catch((e: any) => {
        // Surface the real reason — "no family", auth issues, etc. so the
        // user can act on it instead of staring at a generic "ERROR".
        setError(e?.message ?? "Unknown error");
      });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => nav.goBack()} style={{ padding: SPACING.md }}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={styles.title}>{family?.name ?? "—"}</Text>
        {!!user && <Text style={styles.username}>@{user.username}</Text>}
        <Text style={styles.sub}>Ask them to scan this with Outside.</Text>

        <View style={styles.qrWrap}>
          {error ? (
            <View style={{ alignItems: "center" }}>
              <Text style={styles.errEmoji}>⚠️</Text>
              <Text style={styles.errTitle}>Couldn't generate code</Text>
              <Text style={styles.errBody}>{error}</Text>
            </View>
          ) : !nonce ? (
            <ActivityIndicator color={COLORS.accent} size="large" />
          ) : (
            <QRCode value={nonce} size={240} backgroundColor="#fff" color="#000" />
          )}
        </View>

        <Text style={styles.hint}>Valid for 24 hours · single-use</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  back: { color: COLORS.accent, fontSize: FONT_SIZE.md, fontWeight: "600" },
  body: { flex: 1, alignItems: "center", padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "800", color: COLORS.textPrimary },
  sub: { color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: "center" },
  qrWrap: {
    marginTop: SPACING.xxl,
    padding: SPACING.lg,
    backgroundColor: "#fff",
    borderRadius: RADIUS.xl,
    ...SHADOW.md,
  },
  hint: { marginTop: SPACING.xl, color: COLORS.textTertiary, fontSize: FONT_SIZE.sm },
  username: {
    color: COLORS.accent,
    fontWeight: "700",
    marginTop: SPACING.xs,
  },
  errEmoji: { fontSize: 40, marginBottom: SPACING.sm },
  errTitle: { fontSize: FONT_SIZE.md, fontWeight: "700", color: COLORS.danger },
  errBody: {
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: "center",
    paddingHorizontal: SPACING.md,
  },
});
