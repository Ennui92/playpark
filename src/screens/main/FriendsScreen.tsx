import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Share,
  Platform,
  Image,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "@/components/Button";
import { showDialog } from "@/components/dialog";
import { LiveDot } from "@/components/LiveDot";
import {
  addFriendViaUsername,
  getFriendFamilies,
  removeFriendship,
  getPendingFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
} from "@/services/friends";
import { getActiveFeed } from "@/services/broadcasts";
import { useSession } from "@/contexts/SessionContext";
import { useT } from "@/i18n";
import { FriendFamily, FriendRequest, BroadcastFeedItem, RootStackParamList } from "@/types";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function FriendsScreen() {
  const nav = useNavigation<Nav>();
  const { family, user, refreshBadges } = useSession();
  const t = useT();
  const [friends, setFriends] = useState<FriendFamily[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  // family_id → that friend's current active broadcast (so we can show a
  // pulsing "out now" cue and link straight to where they are).
  const [liveByFamily, setLiveByFamily] = useState<Map<string, BroadcastFeedItem>>(new Map());
  const [username, setUsername] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!family) return;
    const [fs, reqs, feed] = await Promise.all([
      getFriendFamilies(family.id),
      getPendingFriendRequests(),
      getActiveFeed(),
    ]);
    setFriends(fs);
    setPendingRequests(reqs);
    const live = new Map<string, BroadcastFeedItem>();
    for (const b of feed) {
      if (b.family_id !== family.id && !live.has(b.family_id)) live.set(b.family_id, b);
    }
    setLiveByFamily(live);
    setRefreshing(false);
    // Bubble badge count refresh up to the session so the tab badge
    // updates after we accept/decline here.
    await refreshBadges?.();
  }, [family, refreshBadges]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh live cues + requests whenever the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function addByUsername() {
    const u = username.trim().toLowerCase();
    if (!u) return;
    setAdding(true);
    try {
      await addFriendViaUsername(u);
      setUsername("");
      showDialog(t("friends.requestSent"), t("friends.requestSentSub", { username: u }));
      await load();
    } catch (e: any) {
      showDialog(t("friends.couldntAdd"), e.message ?? t("common.tryAgain"));
    } finally {
      setAdding(false);
    }
  }

  async function onAccept(reqId: string) {
    // Optimistic — drop the row from local state immediately.
    setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
    try {
      await acceptFriendRequest(reqId);
      await load();
    } catch (e: any) {
      showDialog(t("friends.couldntAccept"), e.message ?? t("common.tryAgain"));
      await load();
    }
  }

  async function onDecline(reqId: string) {
    setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
    try {
      await declineFriendRequest(reqId);
      await refreshBadges?.();
    } catch (e: any) {
      showDialog(t("friends.couldntDecline"), e.message ?? t("common.tryAgain"));
      await load();
    }
  }

  async function copyUsername() {
    if (!user) return;
    await Clipboard.setStringAsync(`@${user.username}`);
    showDialog(t("friends.copied"), t("friends.copiedSub", { username: user.username }));
  }

  async function shareUsername() {
    if (!user) return;
    const msg = t("friends.shareMessage", { username: user.username });
    try {
      await Share.share(
        Platform.OS === "ios"
          ? { message: msg }
          : { message: msg, title: t("friends.shareTitle") }
      );
    } catch {
      // user cancelled — silent
    }
  }

  function confirmRemove(f: FriendFamily) {
    showDialog(t("friends.removeTitle", { name: f.name }), t("friends.removeSub"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("friends.remove"),
        style: "destructive",
        onPress: async () => {
          await removeFriendship(f.id);
          setFriends((prev) => prev.filter((x) => x.id !== f.id));
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={friends}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{t("friends.title")}</Text>

            {pendingRequests.length > 0 && (
              <View style={styles.pendingCard}>
                <Text style={styles.pendingTitle}>
                  {t(
                    pendingRequests.length === 1
                      ? "friends.requestsOne"
                      : "friends.requestsMany",
                    { count: pendingRequests.length }
                  )}
                </Text>
                {pendingRequests.map((req) => (
                  <View key={req.id} style={styles.pendingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pendingName}>{req.from_family_name}</Text>
                      <Text style={styles.pendingMeta}>{req.from_family_zip}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => onAccept(req.id)}
                    >
                      <Text style={styles.acceptBtnText}>{t("friends.accept")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineBtn}
                      onPress={() => onDecline(req.id)}
                    >
                      <Text style={styles.declineBtnText}>{t("friends.decline")}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {!!user && (
              <View style={styles.youCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.youLabel}>{t("friends.yourHandle")}</Text>
                  <Text style={styles.youHandle}>@{user.username}</Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={copyUsername}>
                  <Text style={styles.iconBtnText}>{t("friends.copy")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtnPrimary} onPress={shareUsername}>
                  <Text style={styles.iconBtnPrimaryText}>{t("friends.share")}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.qrRow}>
              <Button
                title={t("friends.showQr")}
                variant="primary"
                onPress={() => nav.navigate("QRShare")}
                style={{ flex: 1 }}
              />
              <Button
                title={t("friends.scanQr")}
                variant="secondary"
                onPress={() => nav.navigate("QRScan")}
                style={{ flex: 1 }}
              />
            </View>

            <Text style={styles.or}>{t("friends.orAddByUsername")}</Text>
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                placeholder="chen_family"
                placeholderTextColor={COLORS.textTertiary}
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                autoCapitalize="none"
              />
              <Button
                title={t("common.add")}
                onPress={addByUsername}
                loading={adding}
                disabled={username.length < 3}
              />
            </View>

            <Text style={[styles.sectionLabel, { marginTop: SPACING.xl }]}>
              {t(friends.length === 1 ? "friends.countOne" : "friends.countMany", {
                count: friends.length,
              })}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👯</Text>
            <Text style={styles.emptyTitle}>{t("friends.emptyTitle")}</Text>
            <Text style={styles.emptySub}>{t("friends.emptySub")}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const live = liveByFamily.get(item.id);
          return (
            <TouchableOpacity
              style={[styles.friendCard, live && styles.friendCardLive]}
              onPress={() =>
                live
                  ? // Live → take them to where the friend is going. Their
                    // profile is one tap away from there (the name is a link).
                    nav.navigate("Landmark", { landmarkId: live.landmark_id })
                  : nav.navigate("FriendProfile", { familyId: item.id })
              }
              onLongPress={() => confirmRemove(item)}
            >
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.friendNameRow}>
                  <Text style={styles.friendName}>{item.name}</Text>
                  {live && <LiveDot size={8} />}
                </View>
                {live ? (
                  // The whole row already opens the place; this is just the
                  // "out now → where" line.
                  <Text style={styles.friendLive} numberOfLines={1}>
                    {live.landmark_emoji ?? "📍"} {live.landmark_name} · {t("friends.outNow")}
                  </Text>
                ) : (
                  <Text style={styles.friendZip}>{item.zip}</Text>
                )}
                {!!item.note && (
                  <Text style={styles.friendNote} numberOfLines={2}>
                    {item.note}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.xl },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  youCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  youLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
  },
  youHandle: { color: COLORS.accent, fontWeight: "800", fontSize: FONT_SIZE.lg, marginTop: 2 },
  iconBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBtnText: { color: COLORS.textPrimary, fontWeight: "700" },
  iconBtnPrimary: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accent,
  },
  iconBtnPrimaryText: { color: "#fff", fontWeight: "700" },
  qrRow: { flexDirection: "row", gap: SPACING.sm },
  or: {
    color: COLORS.textTertiary,
    textAlign: "center",
    marginVertical: SPACING.md,
    textTransform: "uppercase",
    fontSize: FONT_SIZE.xs,
    fontWeight: "700",
    letterSpacing: 1,
  },
  addRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOW.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", color: COLORS.accent, fontSize: FONT_SIZE.lg },
  friendCardLive: { borderWidth: 1, borderColor: COLORS.ever },
  friendNameRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  friendName: { fontSize: FONT_SIZE.md, fontWeight: "700", color: COLORS.textPrimary },
  friendZip: { color: COLORS.textSecondary, marginTop: 2 },
  friendLive: { color: COLORS.ever, fontWeight: "700", marginTop: 2 },
  friendNote: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.sm,
    fontStyle: "italic",
    marginTop: 2,
  },
  empty: { alignItems: "center", paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: "700", color: COLORS.textPrimary },
  emptySub: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.xs,
  },
  pendingCard: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOW.sm,
  },
  pendingTitle: {
    fontWeight: "800",
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  pendingName: { fontWeight: "700", color: COLORS.textPrimary, fontSize: FONT_SIZE.md },
  pendingMeta: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, marginTop: 2 },
  acceptBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accent,
  },
  acceptBtnText: { color: "#fff", fontWeight: "700" },
  declineBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  declineBtnText: { color: COLORS.textPrimary, fontWeight: "700" },
});
