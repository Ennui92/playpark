import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeFeed } from '@/services/firebase/feedService';
import { confirmPlaydate } from '@/services/firebase/checkInService';
import { FeedEntry, FeedStackParamList } from '@/types';
import { FeedCard } from '@/components/FeedCard';
import { COLORS, FONT_SIZE, SPACING } from '@/utils/theme';
import { isNotificationMuted, endOfTodayTimestamp } from '@/utils/helpers';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

type Nav = NativeStackNavigationProp<FeedStackParamList, 'Feed'>;

export function FeedScreen() {
  const navigation = useNavigation<Nav>();
  const { appUser } = useAuth();
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!appUser) return;

    const unsubscribe = subscribeFeed(appUser.uid, (entries) => {
      setFeed(entries);
      setLoading(false);
      setRefreshing(false);
    });

    return unsubscribe;
  }, [appUser]);

  const handleConfirm = useCallback(async (checkInId: string) => {
    if (!appUser) return;
    await confirmPlaydate(checkInId, appUser.uid);
  }, [appUser]);

  const handleMuteToday = useCallback(async () => {
    if (!appUser) return;
    await updateDoc(doc(db, 'users', appUser.uid), {
      'notificationPrefs.mutedUntil': endOfTodayTimestamp(),
    });
  }, [appUser]);

  const isMuted = appUser ? isNotificationMuted(appUser.notificationPrefs.mutedUntil) : false;

  const activeFeed = feed.filter((e) => e.status !== 'left');
  const recentFeed = feed.filter((e) => e.status === 'left');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: SPACING.xxl }} color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🛝 PlayPark</Text>
        <TouchableOpacity onPress={handleMuteToday}>
          <Text style={styles.muteButton}>
            {isMuted ? '🔕 Muted today' : '🔔'}
          </Text>
        </TouchableOpacity>
      </View>

      {isMuted && (
        <View style={styles.mutedBanner}>
          <Text style={styles.mutedText}>
            Notifications are muted for today. Tap the bell to change in Settings.
          </Text>
        </View>
      )}

      <FlatList
        data={[...activeFeed, ...recentFeed]}
        keyExtractor={(item) => item.checkInId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => setRefreshing(true)}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={<EmptyFeed />}
        ListHeaderComponent={
          activeFeed.length > 0 ? (
            <Text style={styles.sectionHeader}>At the park now</Text>
          ) : null
        }
        renderItem={({ item, index }) => {
          const isFirstLeft =
            item.status === 'left' &&
            (index === 0 || feed[index - 1]?.status !== 'left');

          return (
            <>
              {isFirstLeft && recentFeed.length > 0 && (
                <Text style={styles.sectionHeader}>Recently left</Text>
              )}
              <FeedCard
                entry={item}
                currentUserId={appUser?.uid ?? ''}
                onConfirm={() => handleConfirm(item.checkInId)}
                onPress={() =>
                  navigation.navigate('CheckInDetail', { checkInId: item.checkInId })
                }
                onPressUser={() =>
                  item.userId !== appUser?.uid &&
                  navigation.navigate('FriendProfile', { userId: item.userId })
                }
                onPressPlayground={() =>
                  navigation.navigate('PlaygroundDetail', {
                    playgroundId: item.playgroundId,
                    playgroundName: item.playgroundName,
                  })
                }
              />
            </>
          );
        }}
      />
    </SafeAreaView>
  );
}

function EmptyFeed() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🌳</Text>
      <Text style={styles.emptyTitle}>No one at the park yet</Text>
      <Text style={styles.emptySubtitle}>
        When a parent friend checks in, you'll see them here — and get a notification.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.textPrimary },
  muteButton: { fontSize: FONT_SIZE.xl },
  mutedBanner: {
    backgroundColor: COLORS.accentLight,
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  mutedText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xxl },
  sectionHeader: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl, paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.md },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
