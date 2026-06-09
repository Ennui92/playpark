import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "@/components/Button";
import {
  getLandmarkById,
  subscribeToLandmark,
  unsubscribeFromLandmark,
  getSubscribedLandmarkIds,
  updateUserLandmark,
  deleteUserLandmark,
} from "@/services/landmarks";
import { Alert } from "react-native";
import {
  getActiveBroadcastsForLandmark,
  setBroadcastRsvp,
  getRsvpsForBroadcast,
  endBroadcast,
  updateBroadcastMessage,
} from "@/services/broadcasts";
import {
  favoriteLandmark,
  getFavoriteLandmarkIds,
  unfavoriteLandmark,
} from "@/services/favorites";
import { MapPreview } from "@/components/MapPreview";
import { Landmark, BroadcastFeedItem, BroadcastRsvpRow, RsvpStatus, RootStackParamList } from "@/types";
import { useSession } from "@/contexts/SessionContext";
import { useT, TranslationKey } from "@/i18n";
import { COLORS, FONT_SIZE, RADIUS, SPACING, SHADOW } from "@/utils/theme";
import { formatWhen } from "@/utils/format";

type Nav = NativeStackNavigationProp<RootStackParamList, "Landmark">;
type Route = RouteProp<RootStackParamList, "Landmark">;

export function LandmarkScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { landmarkId } = route.params;
  const { family } = useSession();
  const t = useT();

  const [landmark, setLandmark] = useState<Landmark | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastFeedItem[]>([]);
  // broadcast_id → array of all RSVPs visible to me on that broadcast.
  const [rsvpsByBroadcast, setRsvpsByBroadcast] = useState<
    Record<string, BroadcastRsvpRow[]>
  >({});
  const [subscribed, setSubscribed] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  // Pin-edit mode flips the MapPreview into draggable mode. Only the
  // creator family can use it; RLS will reject from anyone else anyway.
  const [editingPin, setEditingPin] = useState(false);
  const isCreator =
    !!family && !!landmark?.created_by_family_id && landmark.created_by_family_id === family.id;

  async function savePinMove(lat: number, lng: number) {
    if (!landmark) return;
    // Optimistic — the marker already moved on-screen.
    setLandmark({ ...landmark, lat, lng });
    try {
      await updateUserLandmark(landmark.id, { lat, lng });
    } catch (e: any) {
      Alert.alert(t("lm.couldntSavePin"), e.message ?? t("common.tryAgain"));
      // Reload to get the true server state if we lost the race.
      load();
    }
  }

  function confirmDelete() {
    if (!landmark) return;
    Alert.alert(
      t("lm.deleteTitle", { name: landmark.name }),
      t("lm.deleteSub"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("lm.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteUserLandmark(landmark.id);
              nav.goBack();
            } catch (e: any) {
              Alert.alert(t("lm.couldntDelete"), e.message ?? t("common.tryAgain"));
            }
          },
        },
      ]
    );
  }

  const load = useCallback(async () => {
    if (!family) return;
    const [lm, bs, subs, favs] = await Promise.all([
      getLandmarkById(landmarkId),
      getActiveBroadcastsForLandmark(landmarkId),
      getSubscribedLandmarkIds(family.id),
      getFavoriteLandmarkIds(family.id),
    ]);
    setLandmark(lm);
    setBroadcasts(bs);
    setSubscribed(subs.has(landmarkId));
    setFavorite(favs.has(landmarkId));

    // RSVPs are per-broadcast — fetch in parallel.
    const rsvpResults = await Promise.all(
      bs.map((b) => getRsvpsForBroadcast(b.id).then((rs) => [b.id, rs] as const))
    );
    setRsvpsByBroadcast(Object.fromEntries(rsvpResults));

    setLoading(false);
  }, [family, landmarkId]);

  // Does the current family already have an ACTIVE broadcast at this
  // landmark? If so, the footer flips to status-update + end mode.
  const myActiveBroadcast = useMemo(
    () => broadcasts.find((b) => b.family_id === family?.id) ?? null,
    [broadcasts, family?.id]
  );
  const [updatingBroadcast, setUpdatingBroadcast] = useState(false);

  async function onStatusPreset(
    broadcastId: string,
    preset: { labelKey: TranslationKey; messageKey: TranslationKey; ends?: boolean }
  ) {
    setUpdatingBroadcast(true);
    try {
      const message = t(preset.messageKey);
      if (preset.ends) {
        await endBroadcast(broadcastId, message);
      } else {
        await updateBroadcastMessage(broadcastId, message);
      }
      Alert.alert(t("lm.sent"), t("lm.sentSub"));
      await load();
    } catch (e: any) {
      Alert.alert(t("lm.couldntSend"), e?.message ?? t("common.tryAgain"));
    } finally {
      setUpdatingBroadcast(false);
    }
  }

  async function onEndBroadcast(broadcastId: string) {
    Alert.alert(t("lm.endTitle"), t("lm.endSub"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("lm.end"),
        style: "destructive",
        onPress: async () => {
          setUpdatingBroadcast(true);
          try {
            await endBroadcast(broadcastId);
            await load();
          } catch (e: any) {
            Alert.alert(t("lm.couldntEnd"), e?.message ?? t("common.tryAgain"));
          } finally {
            setUpdatingBroadcast(false);
          }
        },
      },
    ]);
  }

  // Optimistic RSVP toggle. Updates local state immediately, fires the
  // RPC, reloads on error.
  async function onRsvp(broadcastId: string, status: RsvpStatus) {
    if (!family) return;
    const prev = rsvpsByBroadcast[broadcastId] ?? [];
    const without = prev.filter((r) => r.family_id !== family.id);
    const next: BroadcastRsvpRow = {
      broadcast_id: broadcastId,
      family_id: family.id,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      family_name: family.name,
    };
    setRsvpsByBroadcast({
      ...rsvpsByBroadcast,
      [broadcastId]: [...without, next],
    });
    try {
      await setBroadcastRsvp(broadcastId, status);
    } catch (e: any) {
      Alert.alert(t("lm.rsvpCouldnt"), e?.message ?? t("common.tryAgain"));
      await load();
    }
  }

  async function toggleFavorite() {
    if (!family) return;
    const next = !favorite;
    setFavorite(next);
    try {
      if (next) await favoriteLandmark(family.id, landmarkId);
      else await unfavoriteLandmark(family.id, landmarkId);
    } catch {
      setFavorite(!next);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function toggleSubscribe(next: boolean) {
    if (!family) return;
    // Optimistic — the toggle feel matters more than the server round-trip.
    setSubscribed(next);
    try {
      if (next) await subscribeToLandmark(family.id, landmarkId);
      else await unsubscribeFromLandmark(family.id, landmarkId);
    } catch {
      setSubscribed(!next);
    }
  }

  if (loading || !landmark) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: SPACING.xxl }} />
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
          <Text style={styles.heroEmoji}>{landmark.emoji}</Text>
          <Text style={styles.heroName}>{landmark.name}</Text>
          <Text style={styles.heroMeta}>
            {t(`cat.${landmark.category}` as TranslationKey)} · {landmark.zip}
          </Text>
          <TouchableOpacity onPress={toggleFavorite} style={styles.favBtn}>
            <Text style={styles.favEmoji}>{favorite ? "❤️" : "🤍"}</Text>
            <Text style={styles.favLabel}>
              {favorite ? t("lm.favorited") : t("lm.favorite")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: SPACING.md, marginVertical: SPACING.sm }}>
          <MapPreview
            lat={landmark.lat}
            lng={landmark.lng}
            label={landmark.name}
            onCoordChange={editingPin ? savePinMove : undefined}
            showDirections={!editingPin}
          />
        </View>

        {isCreator && (
          <View style={styles.creatorRow}>
            <TouchableOpacity
              style={[styles.creatorBtn, editingPin && styles.creatorBtnActive]}
              onPress={() => setEditingPin((v) => !v)}
            >
              <Text style={[styles.creatorBtnText, editingPin && styles.creatorBtnTextActive]}>
                {editingPin ? t("lm.donePin") : t("lm.movePin")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.creatorBtnDanger} onPress={confirmDelete}>
              <Text style={styles.creatorBtnDangerText}>{t("lm.deletePlace")}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.subRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subTitle}>{t("lm.notifyTitle")}</Text>
            <Text style={styles.subHint}>{t("lm.notifySub")}</Text>
          </View>
          <Switch
            value={subscribed}
            onValueChange={toggleSubscribe}
            trackColor={{ true: COLORS.accent, false: COLORS.border }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("lm.whosHeaded")}</Text>
          {broadcasts.length === 0 ? (
            <Text style={styles.empty}>{t("lm.noOneYet")}</Text>
          ) : (
            broadcasts.map((b) => {
              const rsvps = rsvpsByBroadcast[b.id] ?? [];
              const coming = rsvps.filter((r) => r.status === "coming");
              const maybe = rsvps.filter((r) => r.status === "maybe");
              const mine = rsvps.find((r) => r.family_id === family?.id);
              const isOwnBroadcast = b.family_id === family?.id;

              return (
                <View key={b.id} style={styles.bcCard}>
                  <Text style={styles.bcWho}>{b.family_name}</Text>
                  <Text style={styles.bcWhen}>
                    {formatWhen(new Date(b.planned_at))}
                  </Text>
                  {!!b.message && <Text style={styles.bcMsg}>"{b.message}"</Text>}

                  {(coming.length > 0 || maybe.length > 0) && (
                    <Text style={styles.bcRsvpSummary}>
                      {coming.length > 0 && t("lm.summaryComing", { count: coming.length })}
                      {coming.length > 0 && maybe.length > 0 && " · "}
                      {maybe.length > 0 && t("lm.summaryMaybe", { count: maybe.length })}
                      {coming.length > 0 &&
                        ` (${coming.slice(0, 3).map((r) => r.family_name).join(", ")}${coming.length > 3 ? ` +${coming.length - 3}` : ""})`}
                    </Text>
                  )}

                  {!isOwnBroadcast && (
                    <View style={styles.rsvpRow}>
                      {(["coming", "maybe", "not_coming"] as const).map((s) => {
                        const active = mine?.status === s;
                        const label =
                          s === "coming"
                            ? t("lm.rsvpComing")
                            : s === "maybe"
                              ? t("lm.rsvpMaybe")
                              : t("lm.rsvpCant");
                        return (
                          <TouchableOpacity
                            key={s}
                            style={[styles.rsvpBtn, active && styles.rsvpBtnActive]}
                            onPress={() => onRsvp(b.id, s)}
                          >
                            <Text
                              style={[
                                styles.rsvpBtnText,
                                active && styles.rsvpBtnTextActive,
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {myActiveBroadcast ? (
          <View>
            <Text style={styles.footerLabel}>{t("lm.youreBroadcasting")}</Text>
            <View style={styles.statusChips}>
              {STATUS_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.labelKey}
                  style={styles.statusChip}
                  onPress={() => onStatusPreset(myActiveBroadcast.id, preset)}
                  disabled={updatingBroadcast}
                >
                  <Text style={styles.statusChipText}>{t(preset.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => onEndBroadcast(myActiveBroadcast.id)}
              style={styles.endBtn}
              disabled={updatingBroadcast}
            >
              <Text style={styles.endBtnText}>{t("lm.endBroadcast")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Button
            title={t("lm.broadcastGoing")}
            onPress={() => nav.navigate("BroadcastCompose", { landmarkId })}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// Labels are translation keys resolved at render/send time so the
// broadcaster's status message goes out in their chosen language.
const STATUS_PRESETS: { labelKey: TranslationKey; messageKey: TranslationKey; ends?: boolean }[] = [
  { labelKey: "lm.statusLate", messageKey: "lm.statusLate" },
  { labelKey: "lm.statusArrived", messageKey: "lm.statusArrived" },
  { labelKey: "lm.statusHome", messageKey: "lm.statusHome", ends: true },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { padding: SPACING.md },
  back: { color: COLORS.accent, fontSize: FONT_SIZE.md, fontWeight: "600" },
  hero: { alignItems: "center", padding: SPACING.xl },
  heroEmoji: { fontSize: 72 },
  heroName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
    textAlign: "center",
  },
  heroMeta: { color: COLORS.textSecondary, marginTop: SPACING.xs, textTransform: "capitalize" },
  favBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    ...SHADOW.sm,
  },
  favEmoji: { fontSize: 20 },
  favLabel: { color: COLORS.textPrimary, fontWeight: "700" },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
    ...SHADOW.sm,
  },
  subTitle: { fontWeight: "700", color: COLORS.textPrimary, fontSize: FONT_SIZE.md },
  subHint: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginTop: 2 },
  section: { padding: SPACING.lg },
  sectionTitle: { fontWeight: "700", fontSize: FONT_SIZE.lg, marginBottom: SPACING.sm },
  empty: { color: COLORS.textSecondary },
  creatorRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  creatorBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
  },
  creatorBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  creatorBtnText: { color: COLORS.textPrimary, fontWeight: "700" },
  creatorBtnTextActive: { color: "#fff" },
  creatorBtnDanger: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.danger,
    alignItems: "center",
  },
  creatorBtnDangerText: { color: COLORS.danger, fontWeight: "700" },
  bcCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  bcWho: { fontWeight: "700", color: COLORS.textPrimary, fontSize: FONT_SIZE.md },
  bcWhen: { color: COLORS.ever, fontWeight: "600", marginTop: 2 },
  bcMsg: { color: COLORS.textSecondary, marginTop: SPACING.xs, fontStyle: "italic" },
  bcRsvpSummary: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.sm,
    fontWeight: "600",
  },
  rsvpRow: {
    flexDirection: "row",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  rsvpBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: "center",
  },
  rsvpBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  rsvpBtnText: {
    color: COLORS.textPrimary,
    fontWeight: "700",
    fontSize: FONT_SIZE.sm,
  },
  rsvpBtnTextActive: { color: "#fff" },
  footerLabel: {
    color: COLORS.accent,
    fontWeight: "800",
    fontSize: FONT_SIZE.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  statusChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  statusChip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  statusChipText: { color: COLORS.accent, fontWeight: "700", fontSize: FONT_SIZE.sm },
  endBtn: {
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  endBtnText: { color: COLORS.danger, fontWeight: "700", fontSize: FONT_SIZE.sm },
  footer: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
