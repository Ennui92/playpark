import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@/components/Button";
import { showDialog } from "@/components/dialog";
import { ZipPicker } from "@/components/ZipPicker";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useSession } from "@/contexts/SessionContext";
import { useT } from "@/i18n";
import { isLikelyPostalCode, normalizePostalCode } from "@/utils/postal";
import { COLORS, FONT_SIZE, SPACING } from "@/utils/theme";

export function EditNeighborhoodScreen() {
  const nav = useNavigation();
  const { family, refreshProfile } = useSession();
  const t = useT();
  const [zip, setZip] = useState(family?.zip ?? null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!family || !zip || !isLikelyPostalCode(zip)) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "families", family.id), {
        zip: normalizePostalCode(zip),
      });
    } catch (e: any) {
      setSaving(false);
      showDialog(t("nb.couldntUpdate"), e?.message ?? "");
      return;
    }
    setSaving(false);
    await refreshProfile();
    nav.goBack();
  }

  const changed = zip && zip !== family?.zip;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={styles.cancel}>{t("common.cancel")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{t("nb.title")}</Text>
        <Text style={styles.sub}>{t("nb.sub")}</Text>

        <View style={{ marginTop: SPACING.lg }}>
          <ZipPicker value={zip} onChange={setZip} />
        </View>

        <Button
          title={t("common.save")}
          onPress={save}
          loading={saving}
          disabled={!changed}
          style={{ marginTop: SPACING.xl }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { padding: SPACING.md, alignItems: "flex-end" },
  cancel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
  body: { padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "800", color: COLORS.textPrimary },
  sub: { color: COLORS.textSecondary, marginTop: SPACING.xs },
});
