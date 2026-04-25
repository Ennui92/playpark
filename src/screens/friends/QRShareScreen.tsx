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
  const { family } = useSession();
  const [nonce, setNonce] = useState<string | null>(null);

  useEffect(() => {
    generateQrNonce().then(setNonce).catch(() => setNonce("ERROR"));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => nav.goBack()} style={{ padding: SPACING.md }}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={styles.title}>{family?.name}</Text>
        <Text style={styles.sub}>Ask them to scan this with Outside.</Text>

        <View style={styles.qrWrap}>
          {!nonce ? (
            <ActivityIndicator color={COLORS.accent} size="large" />
          ) : nonce === "ERROR" ? (
            <Text style={{ color: COLORS.danger }}>Couldn't generate code</Text>
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
});
