import React from "react";
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import { Button } from "@/components/Button";
import { useSession } from "@/contexts/SessionContext";
import { deleteMyAccount } from "@/services/auth";
import { RootStackParamList } from "@/types";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

// Pulled at module-load time so we don't recompute on every render.
// `version` comes from app.json. `buildNumber` and `gitSha` are
// injected by the GitHub Actions workflow before EAS build (see
// .github/workflows/build-android.yml), so they always reflect the
// CI run that produced this specific APK.
const extra = (Constants.expoConfig?.extra ?? {}) as {
  buildNumber?: string;
  gitSha?: string;
};
const APP_VERSION = Constants.expoConfig?.version ?? "—";
const BUILD_NUMBER = extra.buildNumber ?? "local";
const GIT_SHA = (extra.gitSha ?? "").slice(0, 7);

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MeScreen() {
  const { family, user, signOut } = useSession();
  const nav = useNavigation<Nav>();
  const avatarUrl = family?.avatar_url ?? null;

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete your account?",
      "This is permanent. Your account, friendships, broadcasts, and any places you added will be removed. Landmarks you contributed stay in the catalogue (no creator credit).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMyAccount();
              // signOut state propagates automatically via the session
              // context's onAuthStateChange listener, so we don't need
              // to navigate manually.
            } catch (e: any) {
              Alert.alert("Couldn't delete", e?.message ?? "Try again.");
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.heroRow}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.heroAvatar} />
          ) : (
            <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
              <Text style={styles.heroAvatarText}>
                {(family?.name ?? "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{family?.name ?? "Your account"}</Text>
            <Text style={styles.sub}>
              {user?.display_name} · @{user?.username}
            </Text>
          </View>
        </View>

        {!!family?.bio && <Text style={styles.bio}>{family.bio}</Text>}

        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => nav.navigate("EditProfile")}
        >
          <Text style={styles.editBtnText}>✏️ Edit profile</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.rowTap}
            onPress={() => nav.navigate("EditNeighborhood")}
          >
            <Text style={styles.rowLabel}>Neighborhood</Text>
            <Text style={styles.rowValueLink}>{family?.zip ?? "—"} ›</Text>
          </TouchableOpacity>
          <Row label="Username" value={`@${user?.username ?? "—"}`} />
        </View>

        <Button
          title="Sign out"
          variant="secondary"
          onPress={() =>
            Alert.alert("Sign out?", "", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: signOut },
            ])
          }
          style={{ marginTop: SPACING.xl }}
        />

        <TouchableOpacity onPress={confirmDeleteAccount} style={styles.dangerLink}>
          <Text style={styles.dangerLinkText}>Delete account</Text>
        </TouchableOpacity>

        <Text style={styles.version}>
          Outside v{APP_VERSION} · build {BUILD_NUMBER}
          {GIT_SHA ? ` · ${GIT_SHA}` : ""}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "800", color: COLORS.textPrimary },
  sub: { color: COLORS.textSecondary, marginTop: SPACING.xs },
  card: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
  },
  rowTap: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
  },
  rowLabel: { color: COLORS.textSecondary },
  rowValue: { color: COLORS.textPrimary, fontWeight: "600" },
  rowValueLink: { color: COLORS.accent, fontWeight: "700" },
  version: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    textAlign: "center",
    marginTop: SPACING.xxl,
  },
  dangerLink: {
    alignSelf: "center",
    marginTop: SPACING.lg,
    padding: SPACING.sm,
  },
  dangerLinkText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.sm,
    fontWeight: "600",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentLight,
  },
  heroAvatarFallback: { alignItems: "center", justifyContent: "center" },
  heroAvatarText: { color: COLORS.accent, fontWeight: "800", fontSize: 26 },
  bio: {
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    lineHeight: 22,
  },
  editBtn: {
    alignSelf: "flex-start",
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editBtnText: { color: COLORS.textPrimary, fontWeight: "700" },
});
