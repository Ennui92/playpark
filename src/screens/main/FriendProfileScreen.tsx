import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { getFamilyById, getFamilyActivity } from "@/services/profile";
import { removeFriendship, getFriendNote, setFriendNote } from "@/services/friends";
import { Button } from "@/components/Button";
import { showDialog } from "@/components/dialog";
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
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    const [f, act, n] = await Promise.all([
      getFamilyById(familyId),
      getFamilyActivity(familyId),
      getFriendNote(familyId),
    ]);
    setFamily(f);
    setActivity(act);
    setNote(n ?? "");
    setSavedNote(n ?? "");
    setLoading(false);
  }, [familyId]);

  const noteChanged = note.trim() !== savedNote;

  async function saveNote() {
    setSavingNote(true);
    try {
      await setFriendNote(familyId, note);
      setSavedNote(note.trim());
    } catch (e: any) {
      showDialog(t("common.somethingWrong"), e?.message ?? t("common.tryAgain"));
    } finally {
      setSavingNote(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  function confirmRemove() {
    if (!family) return;
    showDialog(
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
              showDialog(t("fp.couldntRemove"), e?.message ?? t("common.tryAgain"));
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

        <View style={styles.noteCard}>
          <Text style={styles.noteLabel}>{t("fp.noteLabel")}</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder={t("fp.notePlaceholder")}
            placeholderTextColor={COLORS.textTertiary}
            multiline
            textAlignVertical="top"
            maxLength={280}
          />
          <Text style={styles.noteHint}>{t("fp.noteHint")}</Text>
          {noteChanged && (
            <Button
              title={t("fp.saveNote")}
              onPress={saveNote}
              loading={savingNote}
              style={{ marginTop: SPACING.sm }}
            />
          )}
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
  noteCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    ...SHADOW.sm,
  },
  noteLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  noteInput: {
    minHeight: 64,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    lineHeight: 21,
    padding: 0,
  },
  noteHint: { color: COLORS.textTertiary, fontSize: FONT_SIZE.xs, marginTop: SPACING.sm },
  removeBtn: {
    alignSelf: "center",
    marginTop: SPACING.xxl,
    padding: SPACING.md,
  },
  removeBtnText: { color: COLORS.danger, fontWeight: "700" },
  notFound: { color: COLORS.textSecondary, textAlign: "center", marginTop: SPACING.xxl },
});
