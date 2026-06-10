import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@/components/Button";
import { showDialog } from "@/components/dialog";
import { addFriendViaQr } from "@/services/friends";
import { useT } from "@/i18n";
import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/utils/theme";

export function QRScanScreen() {
  const nav = useNavigation();
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [adding, setAdding] = useState(false);

  async function onScanned(data: string) {
    if (scanned || adding) return;
    setScanned(true);
    setAdding(true);
    try {
      await addFriendViaQr(data);
      showDialog(t("qr.friendsTitle"), t("qr.friendsSub"), [
        { text: t("qr.nice"), onPress: () => nav.goBack() },
      ]);
    } catch (e: any) {
      showDialog(t("qr.couldntAdd"), e.message ?? t("qr.invalidCode"), [
        { text: t("qr.tryAgainBtn"), onPress: () => setScanned(false) },
        { text: t("common.cancel"), onPress: () => nav.goBack(), style: "cancel" },
      ]);
    } finally {
      setAdding(false);
    }
  }

  if (!permission) {
    return <SafeAreaView style={styles.container} />;
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.body}>
          <Text style={styles.title}>{t("qr.permTitle")}</Text>
          <Text style={styles.sub}>{t("qr.permSub")}</Text>
          <Button title={t("qr.grant")} onPress={requestPermission} style={{ marginTop: SPACING.lg }} />
          <Button title={t("common.cancel")} variant="ghost" onPress={() => nav.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.camWrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => onScanned(data)}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeText}>{t("qr.close")}</Text>
        </TouchableOpacity>
        <View style={styles.reticle} />
        <Text style={styles.hint}>{t("qr.point")}</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, padding: SPACING.xl, justifyContent: "center" },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: "800",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  sub: {
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.xs,
  },
  camWrap: { flex: 1, backgroundColor: "#000" },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center" },
  closeBtn: {
    position: "absolute",
    top: SPACING.lg,
    right: SPACING.lg,
    padding: SPACING.sm,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: RADIUS.full,
  },
  closeText: { color: "#fff", fontWeight: "700", paddingHorizontal: SPACING.sm },
  reticle: {
    width: 260,
    height: 260,
    borderColor: "#fff",
    borderWidth: 3,
    borderRadius: RADIUS.xl,
  },
  hint: { color: "#fff", marginTop: SPACING.xl, fontSize: FONT_SIZE.md },
});
