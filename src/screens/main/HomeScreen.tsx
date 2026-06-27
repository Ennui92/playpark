import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSession } from "@/contexts/SessionContext";
import { getLandmarksByZip, getMutedLandmarkIds } from "@/services/landmarks";
import { getActiveFeed, getRsvpsForBroadcast, endBroadcast } from "@/services/broadcasts";
import { showDialog } from "@/components/dialog";
import {
  favoriteLandmark,
  getFavoriteLandmarks,
  unfavoriteLandmark,
} from "@/services/favorites";
import { Landmark, BroadcastFeedItem, RootStackParamList } from "@/types";
import { useT } from "@/i18n";
import { LiveDot } from "@/components/LiveDot";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";
import { formatWhen } from "@/utils/format";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { family } = useSession();
  const t = useT();

  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [feed, setFeed] = useState<BroadcastFeedItem[]>([]);
  const [muted, setMuted] = useState<Set<string>>(new Set());
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [joiningCount, setJoiningCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // True when the feed call itself failed — so we keep the last good feed and
  // show a retry instead of a misleading "no one's out".
  const [feedError, setFeedError] = useState(false);

  const load = useCallback(async () => {
    if (!family) return;
    try {
      // Fetch each source independently so one failing call can't blank the
      // whole screen (a feed hiccup used to silently read as "no one's out").
      const [zipLms, fd, mt, favLms] = await Promise.all([
        getLandmarksByZip(family.zip).catch(() => null),
        getActiveFeed().catch((e) => {
          console.warn("[Home] feed load failed:", e?.message ?? e);
          return null;
        }),
        getMutedLandmarkIds(family.id).catch(() => null),
        getFavoriteLandmarks(family.id).catch(() => null),
      ]);

      // "My places" = everything in my postal code PLUS everything I've
      // saved, anywhere. Saved spots are no longer caged to my PLZ, so an
      // out-of-area place I saved (or RSVP'd "coming" to) stays in my list
      // and I can broadcast it. Dedupe by id.
      if (zipLms || favLms) {
        const byId = new Map<string, Landmark>();
        for (const l of zipLms ?? []) byId.set(l.id, l);
        for (const l of favLms ?? []) byId.set(l.id, l);
        setLandmarks([...byId.values()]);
      }
      if (mt) setMuted(mt);
      if (favLms) setFavs(new Set(favLms.map((l) => l.id)));

      if (fd) {
        setFeed(fd);
        setFeedError(false);
        // How many friends have RSVPed "coming" to MY active broadcast(s)?
        const mine = fd.filter((b) => b.family_id === family.id);
        let joining = 0;
        if (mine.length) {
          const rs = await Promise.all(
            mine.map((b) => getRsvpsForBroadcast(b.id).catch(() => []))
          );
          joining = rs
            .flat()
            .filter((r) => r.status === "coming" && r.family_id !== family.id).length;
        }
        setJoiningCount(joining);
      } else {
        // Keep the last good feed; flag the error so the UI offers a retry.
        setFeedError(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [family]);

  async function toggleFavorite(landmarkId: string) {
    if (!family) return;
    const next = new Set(favs);
    const isFav = favs.has(landmarkId);
    // Optimistic — undo on failure.
    if (isFav) next.delete(landmarkId);
    else next.add(landmarkId);
    setFavs(next);
    try {
      if (isFav) await unfavoriteLandmark(family.id, landmarkId);
      else await favoriteLandmark(family.id, landmarkId);
    } catch {
      setFavs(favs); // revert
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  // Refetch when the tab regains focus — so a newly added place or a
  // just-ended broadcast appears without a manual pull-to-refresh.
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  // Map: landmark_id → active broadcasts there (visible to me via RLS = friends only).
  const broadcastsByLandmark = useMemo(() => {
    const m = new Map<string, BroadcastFeedItem[]>();
    for (const b of feed) {
      const arr = m.get(b.landmark_id) ?? [];
      arr.push(b);
      m.set(b.landmark_id, arr);
    }
    return m;
  }, [feed]);

  // Sort priority (descending): favorites → active broadcasts → alpha.
  const sortedLandmarks = useMemo(() => {
    return [...landmarks].sort((a, b) => {
      const af = favs.has(a.id) ? 1 : 0;
      const bf = favs.has(b.id) ? 1 : 0;
      if (af !== bf) return bf - af;
      const ab = broadcastsByLandmark.has(a.id) ? 1 : 0;
      const bb = broadcastsByLandmark.has(b.id) ? 1 : 0;
      if (ab !== bb) return bb - ab;
      return a.name.localeCompare(b.name);
    });
  }, [landmarks, broadcastsByLandmark, favs]);

  // Split my own broadcasts from friends' so the hero never counts ME as
  // "a friend who's out".
  const myBroadcast = useMemo(
    () => feed.find((b) => b.family_id === family?.id) ?? null,
    [feed, family?.id]
  );
  const amBroadcasting = !!myBroadcast;
  const [stopping, setStopping] = useState(false);

  async function stopBroadcasting() {
    if (!myBroadcast) return;
    setStopping(true);
    try {
      await endBroadcast(myBroadcast.id);
      await load();
    } catch (e: any) {
      showDialog(t("common.somethingWrong"), e?.message ?? t("common.tryAgain"));
    } finally {
      setStopping(false);
    }
  }
  const friendsOutCount = useMemo(
    () => new Set(feed.filter((b) => b.family_id !== family?.id).map((b) => b.family_id)).size,
    [feed, family?.id]
  );

  // Every active friend broadcast, regardless of ZIP or whether I've saved
  // the place. This is the fix for "a friend broadcasts a place I don't have
  // and I can't see it" — these cards link straight to the landmark, which
  // is readable by id even if it's outside my neighbourhood. Soonest first.
  const friendBroadcasts = useMemo(
    () =>
      feed
        .filter((b) => b.family_id !== family?.id)
        .sort((a, b) => new Date(a.planned_at).getTime() - new Date(b.planned_at).getTime()),
    [feed, family?.id]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.xxl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={sortedLandmarks}
        keyExtractor={(l) => l.id}
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
            {/* Active-broadcast banner — always reachable from Home so you
                can stop wherever you are (the per-place Stop is easy to
                lose track of when you're out). */}
            {myBroadcast && (
              <View style={styles.outBanner}>
                <TouchableOpacity
                  style={styles.outBannerMain}
                  onPress={() =>
                    nav.navigate("Landmark", { landmarkId: myBroadcast.landmark_id })
                  }
                  activeOpacity={0.85}
                >
                  <LiveDot size={9} color="#fff" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.outBannerLabel}>{t("home.youreOutBanner")}</Text>
                    <Text style={styles.outBannerPlace} numberOfLines={1}>
                      {myBroadcast.landmark_emoji} {myBroadcast.landmark_name} ·{" "}
                      {formatWhen(new Date(myBroadcast.planned_at))}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.outBannerStop}
                  onPress={stopBroadcasting}
                  disabled={stopping}
                >
                  <Text style={styles.outBannerStopText}>{t("home.stop")}</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.hello}>
              {t("home.greeting", { name: family?.name ?? "👋" })}
            </Text>
            <Text style={styles.hero}>
              {amBroadcasting ? (
                <>
                  {t("home.youreA")}
                  <Text style={styles.heroNum}>{t("home.outWord")}</Text>
                  {joiningCount > 0 ? (
                    <>
                      {" · "}
                      <Text style={styles.heroNum}>{joiningCount}</Text>{" "}
                      {t(joiningCount === 1 ? "home.joiningSuffixOne" : "home.joiningSuffixMany")}
                    </>
                  ) : friendsOutCount > 0 ? (
                    <>
                      {" · "}
                      <Text style={styles.heroNum}>{friendsOutCount}</Text>{" "}
                      {t(friendsOutCount === 1 ? "home.alsoOutSuffixOne" : "home.alsoOutSuffixMany")}
                    </>
                  ) : (
                    <>{" — "}{t("home.waitingTail")}</>
                  )}
                </>
              ) : friendsOutCount > 0 ? (
                <>
                  <Text style={styles.heroNum}>{friendsOutCount}</Text>{" "}
                  {t(friendsOutCount === 1 ? "home.friendsOutSuffixOne" : "home.friendsOutSuffixMany")}
                </>
              ) : (
                t("home.outNone")
              )}
            </Text>
            <TouchableOpacity
              style={styles.addRow}
              onPress={() => nav.navigate("AddLandmark")}
              activeOpacity={0.8}
            >
              <Text style={styles.addPlus}>＋</Text>
              <Text style={styles.addText}>{t("home.addPlace")}</Text>
            </TouchableOpacity>

            {feedError && (
              <TouchableOpacity
                style={styles.feedErrorBanner}
                onPress={() => {
                  setRefreshing(true);
                  load();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.feedErrorText}>{t("home.feedError")}</Text>
              </TouchableOpacity>
            )}

            {/* Live now — every friend who's currently out, ANY place, even
                ones outside my ZIP or that I haven't saved. Tap → landmark. */}
            {friendBroadcasts.length > 0 && (
              <View style={styles.liveSection}>
                <View style={styles.liveHeader}>
                  <LiveDot size={9} />
                  <Text style={styles.liveTitle}>{t("home.liveNow")}</Text>
                </View>
                {friendBroadcasts.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.liveCard}
                    onPress={() => nav.navigate("Landmark", { landmarkId: b.landmark_id })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.liveEmoji}>{b.landmark_emoji ?? "📍"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.liveName} numberOfLines={1}>
                        {b.family_name}
                      </Text>
                      <Text style={styles.livePlace} numberOfLines={1}>
                        {b.landmark_name} · {formatWhen(new Date(b.planned_at))}
                      </Text>
                      {!!b.message && (
                        <Text style={styles.liveMsg} numberOfLines={1}>
                          “{b.message}”
                        </Text>
                      )}
                    </View>
                    <Text style={styles.liveChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const active = broadcastsByLandmark.get(item.id) ?? [];
          const isMuted = muted.has(item.id);
          const isFav = favs.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.card, active.length > 0 && styles.cardActive]}
              onPress={() => nav.navigate("Landmark", { landmarkId: item.id })}
              activeOpacity={0.85}
            >
              <Text style={styles.cardEmoji}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardSub}>
                  {active.length > 0
                    ? active
                        .slice(0, 2)
                        .map((b) => `${b.family_name} · ${formatWhen(new Date(b.planned_at))}`)
                        .join(" • ") + (active.length > 2 ? ` • +${active.length - 2}` : "")
                    : isMuted
                      ? t("home.cardMuted")
                      : t("home.cardTap")}
                </Text>
              </View>
              {active.length > 0 && <View style={styles.livePip} />}
              <TouchableOpacity
                // Intercept tap so it doesn't also open the landmark.
                onPress={(e) => {
                  e.stopPropagation();
                  toggleFavorite(item.id);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.heartBtn}
              >
                <Text style={styles.heart}>{isFav ? "❤️" : "🤍"}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.xl, paddingBottom: SPACING.md },
  hello: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  hero: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  // The changing numbers in the hero get the accent colour.
  heroNum: { color: COLORS.accent },
  // "You're out" banner — evergreen, can't-miss, with an inline Stop.
  outBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.ever,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  outBannerMain: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1 },
  outBannerLabel: {
    color: "#fff",
    fontWeight: "800",
    fontSize: FONT_SIZE.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.9,
  },
  outBannerPlace: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZE.md, marginTop: 1 },
  outBannerStop: {
    backgroundColor: "#fff",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  outBannerStopText: { color: COLORS.ever, fontWeight: "800", fontSize: FONT_SIZE.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
    ...SHADOW.sm,
  },
  cardActive: { borderWidth: 2, borderColor: COLORS.ever },
  cardEmoji: { fontSize: 32 },
  cardName: { fontSize: FONT_SIZE.md, fontWeight: "700", color: COLORS.textPrimary },
  cardSub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  livePip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.ever,
  },
  heartBtn: { padding: SPACING.xs },
  heart: { fontSize: 22 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignSelf: "flex-start",
    marginTop: SPACING.md,
  },
  addPlus: { fontSize: FONT_SIZE.lg, color: COLORS.accentDark, fontWeight: "800" },
  addText: { color: COLORS.accentDark, fontWeight: "700" },

  feedErrorBanner: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  feedErrorText: { color: COLORS.accentDark, fontWeight: "600", fontSize: FONT_SIZE.sm },
  // "Live now" — the can't-miss strip of friends currently out.
  liveSection: { marginTop: SPACING.xl },
  liveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  liveTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "800",
    color: COLORS.ever,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  liveCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.ever,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  liveEmoji: { fontSize: 30 },
  liveName: { fontSize: FONT_SIZE.md, fontWeight: "800", color: COLORS.textPrimary },
  livePlace: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 1 },
  liveMsg: { fontSize: FONT_SIZE.sm, color: COLORS.textTertiary, marginTop: 1, fontStyle: "italic" },
  liveChevron: { fontSize: 26, color: COLORS.textTertiary, fontWeight: "300" },
});
