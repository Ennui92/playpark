import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@/components/Button";
import { useSession } from "@/contexts/SessionContext";
import {
  pickAndUploadAvatar,
  updateFamilyProfile,
} from "@/services/profile";
import { useT } from "@/i18n";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

export function EditProfileScreen() {
  const nav = useNavigation();
  const { family, refreshProfile } = useSession();
  const t = useT();

  const [name, setName] = useState(family?.name ?? "");
  const [bio, setBio] = useState(family?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    family?.avatar_url ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(family?.name ?? "");
    setBio(family?.bio ?? "");
    setAvatarUrl(family?.avatar_url ?? null);
  }, [family?.id]);

  async function onPickAvatar() {
    if (!family) return;
    setUploading(true);
    try {
      const url = await pickAndUploadAvatar(family.id);
      setAvatarUrl(url);
    } catch (e: any) {
      if (e?.message !== "Cancelled") {
        Alert.alert(t("ep.uploadFailed"), e?.message ?? t("common.tryAgain"));
      }
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    if (!family) return;
    setSaving(true);
    try {
      await updateFamilyProfile(family.id, {
        name: name.trim() || family.name,
        bio: bio.trim() || null,
      });
      await refreshProfile();
      nav.goBack();
    } catch (e: any) {
      Alert.alert(t("ep.couldntSave"), e?.message ?? t("common.tryAgain"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Text style={styles.back}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>{t("ep.title")}</Text>

          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>
                  {(family?.name ?? "?").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={onPickAvatar}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color={COLORS.accent} />
              ) : (
                <Text style={styles.avatarBtnText}>
                  {avatarUrl ? t("ep.changePhoto") : t("ep.addPhoto")}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Label>{t("ep.nameLabel")}</Label>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("ep.namePlaceholder")}
            placeholderTextColor={COLORS.textTertiary}
            maxLength={40}
          />

          <Label>{t("ep.bioLabel")}</Label>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={bio}
            onChangeText={setBio}
            placeholder={t("ep.bioPlaceholder")}
            placeholderTextColor={COLORS.textTertiary}
            maxLength={280}
            multiline
          />
          <Text style={styles.hint}>{bio.length}/280</Text>

          <Button
            title={t("common.save")}
            onPress={onSave}
            loading={saving}
            disabled={saving}
            style={{ marginTop: SPACING.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { padding: SPACING.md, alignItems: "flex-end" },
  back: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
  body: { padding: SPACING.xl, paddingBottom: SPACING.xxl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "800", color: COLORS.textPrimary },
  avatarWrap: { alignItems: "center", marginTop: SPACING.xl, marginBottom: SPACING.lg },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.accentLight },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: COLORS.accent, fontWeight: "800", fontSize: 48 },
  avatarBtn: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  avatarBtnText: { color: COLORS.accent, fontWeight: "700" },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  inputMulti: { minHeight: 96, textAlignVertical: "top" },
  hint: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, marginTop: SPACING.xs, textAlign: "right" },
});
