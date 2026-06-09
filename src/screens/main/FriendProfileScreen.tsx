import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { getFamilyById, getFamilyActivity } from "@/services/profile";
import { removeFriendship } from "@/services/friends";
import { useT } from "@/i18n";
import { Family, RootStackParamList } from "@/types";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

type Route = RouteProp<RootStackParamList, "FriendProfile">;

export function FriendProfileScreen() {
  const nav = useNavigation();
  const route = useRoute<Route>();
  const { familyId } = route.params;
  const t = useT();

  const [family, setFamily] = useState<Family | null>(null);
  const [activity, setActivity] = useState<{
    activeBroadcasts: number;
    landmarksContributed: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [f, act] = await Promise.all([
      getFamilyById(familyId),
      getFamilyActivity(familyId),
    ]);
    setFamily(f);
    setActivity(act);
    setLoading(false);
  }, [familyId]);

  useEffect(() => {
    load();
  }, [load]);

  function confirmRemove() {
    if (!family) return;
    Alert.alert(
      t("friends.removeTitle", { name: family.name }),
      t("friends.removeSub"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("friends.remove"),
          style: "destructive",
          onPress: async () => {
            try {
              await removeFriendship(family.id);
              nav.goBack();
            } catch (e: any) {
              Alert.alert(t("fp.couldntRemove"), e?.message ?? t("common.tryAgain"));
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.xxl }} />
      </SafeAreaView>
    );
  }

  if (!family) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Text style={styles.back}>{t("common.back")}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.notFound}>{t("fp.notFound")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Text style={styles.back}>{t("common.back")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          {family.avatar_url ? (
            <Image source={{ uri: family.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>
                {family.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{family.name}</Text>
          <Text style={styles.meta}>{family.zip}</Text>
          {!!family.bio && <Text style={styles.bio}>{family.bio}</Text>}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activity?.activeBroadcasts ?? 0}</Text>
            <Text style={styles.statLabel}>{t("fp.activeBroadcasts")}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activity?.landmarksContributed ?? 0}</Text>
            <Text style={styles.statLabel}>{t("fp.placesAdded")}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={confirmRemove} style={styles.removeBtn}>
          <Text style={styles.removeBtnText}>{t("fp.removeFriend")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { padding: SPACING.md },
  back: { color: COLORS.accent, fontSize: FONT_SIZE.md, fontWeight: "600" },
  hero: { alignItems: "center", paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.accentLight },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: COLORS.accent, fontWeight: "800", fontSize: 48 },
  name: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  meta: { color: COLORS.textSecondary, marginTop: SPACING.xs },
  bio: {
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    textAlign: "center",
    fontSize: FONT_SIZE.md,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: "center",
    ...SHADOW.sm,
  },
  statValue: { fontSize: FONT_SIZE.xxl, fontWeight: "800", color: COLORS.accent },
  statLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
  removeBtn: {
    alignSelf: "center",
    marginTop: SPACING.xxl,
    padding: SPACING.md,
  },
  removeBtnText: { color: COLORS.danger, fontWeight: "700" },
  notFound: { color: COLORS.textSecondary, textAlign: "center", marginTop: SPACING.xxl },
});
