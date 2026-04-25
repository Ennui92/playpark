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
import { CheckInStackParamList, Playground } from '@/types';
import { getNearbyPlaygrounds } from '@/services/firebase/checkInService';
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

  useEffect(() => {
    requestLocationAndLoad();
  }, []);

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

  function goToConfirm(playground: Playground) {
    navigation.navigate('CheckInConfirm', {
      playgroundId: playground.id,
      playgroundName: playground.name,
    });
  }

  function goToAddPlayground() {
    navigation.navigate('AddPlayground');
  }

  function goToEditPlayground(playgroundId: string) {
    navigation.navigate('EditPlayground', { playgroundId });
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
          data={playgrounds}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            loadingPlaces ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.lg }} />
            ) : null
          }
          ListEmptyComponent={
            !loadingPlaces ? (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>No playgrounds found nearby.</Text>
                <Text style={styles.emptyHint}>Be the first to add one.</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            !loadingPlaces ? (
              <TouchableOpacity style={styles.addPlaygroundButton} onPress={goToAddPlayground}>
                <Text style={styles.addPlaygroundEmoji}>➕</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addPlaygroundTitle}>Add a playground</Text>
                  <Text style={styles.addPlaygroundHint}>
                    Use your current location to drop a pin.
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.playgroundCard}
              onPress={() => goToConfirm(item)}
              onLongPress={() => goToEditPlayground(item.id)}
            >
              <View style={styles.playgroundInfo}>
                <Text style={styles.playgroundEmoji}>🛝</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playgroundName}>{item.name}</Text>
                  <Text style={styles.playgroundAddress} numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
                {item.checkInCount > 0 && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>
                      {item.checkInCount} here
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => goToEditPlayground(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.editButtonText}>✏︎</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
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
  editButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  editButtonText: { fontSize: FONT_SIZE.md, color: COLORS.primary },
  noLocationEmoji: { fontSize: 48, marginBottom: SPACING.md },
  noLocationTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  noLocationText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center' },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  emptyHint: { fontSize: FONT_SIZE.sm, color: COLORS.textHint },
  addPlaygroundButton: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
  },
  addPlaygroundEmoji: { fontSize: 24 },
  addPlaygroundTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary },
  addPlaygroundHint: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },

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
