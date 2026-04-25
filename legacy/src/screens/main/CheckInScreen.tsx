import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckInStackParamList, Playground, FeedEntry } from '@/types';
import { getNearbyPlaygrounds } from '@/services/firebase/checkInService';
import { getFriendsAtPlaygrounds } from '@/services/firebase/feedService';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCheckIn } from '@/hooks/useActiveCheckIn';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Nav = NativeStackNavigationProp<CheckInStackParamList, 'CheckIn'>;

export function CheckInScreen() {
  const navigation = useNavigation<Nav>();
  const { appUser } = useAuth();
  const { activeCheckIn, leavePlayground, loading: checkInLoading } = useActiveCheckIn(appUser?.uid);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [playgrounds, setPlaygrounds] = useState<Playground[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [friendsByPark, setFriendsByPark] = useState<Map<string, FeedEntry[]>>(new Map());

  useEffect(() => {
    requestLocationAndLoad();
    if (appUser) {
      getFriendsAtPlaygrounds(appUser.uid).then(setFriendsByPark).catch(() => {});
    }
  }, [appUser]);

  async function requestLocationAndLoad() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLoadingLocation(false);
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLocation(loc);
    setLoadingLocation(false);

    setLoadingPlaces(true);
    const nearby = await getNearbyPlaygrounds(loc.coords.latitude, loc.coords.longitude);
    setPlaygrounds(nearby);
    setLoadingPlaces(false);
  }

  // Sort parks with friends first
  const sortedPlaygrounds = React.useMemo(() => {
    return [...playgrounds].sort((a, b) => {
      const aHas = (friendsByPark.get(a.id)?.length ?? 0) > 0 ? 1 : 0;
      const bHas = (friendsByPark.get(b.id)?.length ?? 0) > 0 ? 1 : 0;
      return bHas - aHas;
    });
  }, [playgrounds, friendsByPark]);

  const friendCountNow = React.useMemo(() => {
    let total = 0;
    friendsByPark.forEach((arr) => (total += arr.length));
    return total;
  }, [friendsByPark]);

  function goToConfirm(playground: Playground) {
    navigation.navigate('CheckInConfirm', {
      playgroundId: playground.id,
      playgroundName: playground.name,
    });
  }

  // ── If user is already checked in ─────────────────────────────────────────

  if (activeCheckIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>You're out!</Text>
        </View>
        <View style={styles.activeCard}>
          <Text style={styles.activeEmoji}>
            {activeCheckIn.status === 'en_route' ? '🚶' : '🛝'}
          </Text>
          <Text style={styles.activePark}>{activeCheckIn.playgroundName}</Text>
          <Text style={styles.activeStatus}>
            {activeCheckIn.status === 'en_route' ? 'On the way' : 'You\'re here!'}
          </Text>

          {activeCheckIn.children.length > 0 && (
            <Text style={styles.activeChildren}>
              With: {activeCheckIn.children.map((c) => c.name).join(', ')}
            </Text>
          )}

          <TouchableOpacity
            style={styles.leaveButton}
            onPress={() =>
              Alert.alert('Leave playground?', 'This will update your friends.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Leave', style: 'destructive', onPress: leavePlayground },
              ])
            }
          >
            <Text style={styles.leaveButtonText}>Leave playground</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Normal check-in flow ───────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Check in</Text>
        <Text style={styles.headerSubtitle}>Let friends know where you're heading</Text>
      </View>

      {loadingLocation ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>Finding your location…</Text>
        </View>
      ) : !location ? (
        <View style={styles.centered}>
          <Text style={styles.noLocationEmoji}>📍</Text>
          <Text style={styles.noLocationTitle}>Location needed</Text>
          <Text style={styles.noLocationText}>
            Enable location in Settings to see nearby playgrounds.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedPlaygrounds}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              {friendCountNow > 0 && (
                <View style={styles.heroBanner}>
                  <Text style={styles.heroBannerEmoji}>✨</Text>
                  <Text style={styles.heroBannerText}>
                    {friendCountNow === 1
                      ? '1 friend is at a park right now'
                      : `${friendCountNow} friends are at parks right now`}
                  </Text>
                </View>
              )}
              {loadingPlaces ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.lg }} />
              ) : null}
            </>
          }
          ListEmptyComponent={
            !loadingPlaces ? (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>No playgrounds found nearby.</Text>
                <Text style={styles.emptyHint}>
                  You can add your local park after checking in.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const friendsHere = friendsByPark.get(item.id) ?? [];
            const hasFriends = friendsHere.length > 0;
            return (
              <TouchableOpacity
                style={[styles.playgroundCard, hasFriends && styles.playgroundCardHighlight]}
                onPress={() => goToConfirm(item)}
              >
                <View style={styles.playgroundInfo}>
                  <Text style={styles.playgroundEmoji}>🛝</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playgroundName}>{item.name}</Text>
                    <Text style={styles.playgroundAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                    {hasFriends && (
                      <Text style={styles.friendHereText}>
                        ✨ {friendsHere.map((f) => f.userDisplayName.split(' ')[0]).join(', ')}{' '}
                        {friendsHere.length === 1 ? 'is' : 'are'} here now
                      </Text>
                    )}
                  </View>
                  {item.checkInCount > 0 && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>
                        {item.checkInCount} here
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.textPrimary },
  headerSubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  loadingText: { color: COLORS.textSecondary, marginTop: SPACING.sm },
  list: { padding: SPACING.md, gap: SPACING.sm },
  playgroundCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOW.sm,
  },
  playgroundCardHighlight: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  friendHereText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primaryDark,
    fontWeight: '700',
    marginTop: 4,
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  heroBannerEmoji: { fontSize: 20 },
  heroBannerText: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, fontWeight: '700', flex: 1 },
  playgroundInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  playgroundEmoji: { fontSize: 28 },
  playgroundName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  playgroundAddress: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  activeBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  activeBadgeText: { fontSize: FONT_SIZE.xs, color: COLORS.primaryDark, fontWeight: '600' },
  chevron: { fontSize: 22, color: COLORS.textHint, marginLeft: SPACING.sm },
  noLocationEmoji: { fontSize: 48, marginBottom: SPACING.md },
  noLocationTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  noLocationText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center' },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  emptyHint: { fontSize: FONT_SIZE.sm, color: COLORS.textHint },

  // Active check-in state
  activeCard: {
    margin: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOW.md,
  },
  activeEmoji: { fontSize: 64, marginBottom: SPACING.md },
  activePark: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  activeStatus: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600', marginTop: SPACING.xs },
  activeChildren: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.sm },
  leaveButton: {
    marginTop: SPACING.xl,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  leaveButtonText: { color: COLORS.error, fontWeight: '600', fontSize: FONT_SIZE.md },
});
