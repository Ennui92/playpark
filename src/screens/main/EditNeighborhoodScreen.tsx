import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@/components/Button";
import { ZipPicker } from "@/components/ZipPicker";
import { supabase } from "@/config/supabase";
import { useSession } from "@/contexts/SessionContext";
import { BERLIN_ZIP_SET } from "@/data/berlinZips";
import { COLORS, FONT_SIZE, SPACING } from "@/utils/theme";

export function EditNeighborhoodScreen() {
  const nav = useNavigation();
  const { family, refreshProfile } = useSession();
  const [zip, setZip] = useState(family?.zip ?? null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!family || !zip || !BERLIN_ZIP_SET.has(zip)) return;
    setSaving(true);
    const { error } = await supabase
      .from("families")
      .update({ zip })
      .eq("id", family.id);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    await refreshProfile();
    nav.goBack();
  }

  const changed = zip && zip !== family?.zip;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Change neighborhood</Text>
        <Text style={styles.sub}>
          Your Home list will switch to this PLZ.
        </Text>

        <View style={{ marginTop: SPACING.lg }}>
          <ZipPicker value={zip} onChange={setZip} />
        </View>

        <Button
          title="Save"
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
