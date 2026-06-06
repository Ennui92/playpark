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
} from "@/services/landmarks";
import { getActiveBroadcastsForLandmark } from "@/services/broadcasts";
import {
  favoriteLandmark,
  getFavoriteLandmarkIds,
  unfavoriteLandmark,
} from "@/services/favorites";
import { MapPreview } from "@/components/MapPreview";
import { Landmark, BroadcastFeedItem, RootStackParamList } from "@/types";
import { useSession } from "@/contexts/SessionContext";
import { COLORS, FONT_SIZE, RADIUS, SPACING, SHADOW } from "@/utils/theme";
import { formatWhen } from "@/utils/format";

type Nav = NativeStackNavigationProp<RootStackParamList, "Landmark">;
type Route = RouteProp<RootStackParamList, "Landmark">;

export function LandmarkScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { landmarkId } = route.params;
  const { family } = useSession();

  const [landmark, setLandmark] = useState<Landmark | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastFeedItem[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
  }, [family, landmarkId]);

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
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{landmark.emoji}</Text>
          <Text style={styles.heroName}>{landmark.name}</Text>
          <Text style={styles.heroMeta}>
            {landmark.category.replace("_", " ")} · {landmark.zip}
          </Text>
          <TouchableOpacity onPress={toggleFavorite} style={styles.favBtn}>
            <Text style={styles.favEmoji}>{favorite ? "❤️" : "🤍"}</Text>
            <Text style={styles.favLabel}>
              {favorite ? "Favorited" : "Favorite"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: SPACING.md, marginVertical: SPACING.sm }}>
          <MapPreview lat={landmark.lat} lng={landmark.lng} label={landmark.name} />
        </View>

        <View style={styles.subRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subTitle}>Notify me when friends head here</Text>
            <Text style={styles.subHint}>
              You'll get a push when any friend family broadcasts this spot.
            </Text>
          </View>
          <Switch
            value={subscribed}
            onValueChange={toggleSubscribe}
            trackColor={{ true: COLORS.accent, false: COLORS.border }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Who's headed here</Text>
          {broadcasts.length === 0 ? (
            <Text style={styles.empty}>No one yet. Be the first.</Text>
          ) : (
            broadcasts.map((b) => (
              <View key={b.id} style={styles.bcCard}>
                <Text style={styles.bcWho}>{b.family_name}</Text>
                <Text style={styles.bcWhen}>{formatWhen(new Date(b.planned_at))}</Text>
                {!!b.message && <Text style={styles.bcMsg}>"{b.message}"</Text>}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Broadcast: we're going"
          onPress={() => nav.navigate("BroadcastCompose", { landmarkId })}
        />
      </View>
    </SafeAreaView>
  );
}

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
  footer: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
