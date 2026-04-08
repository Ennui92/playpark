import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { getUserStats } from '@/services/firebase/statsService';
import { UserStats, BADGE_DEFINITIONS } from '@/types';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';
import { formatDate } from '@/utils/helpers';

export function BadgesScreen() {
  const navigation = useNavigation();
  const { appUser } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    getUserStats(appUser.uid).then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, [appUser]);

  const allBadgeIds = Object.keys(BADGE_DEFINITIONS);
  const earnedIds = stats?.badges.map((b) => b.badgeId) ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Badges & Streaks</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xxl }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={allBadgeIds}
          keyExtractor={(id) => id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={stats ? <StreakBanner stats={stats} /> : null}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={({ item: badgeId }) => {
            const def = BADGE_DEFINITIONS[badgeId];
            const earned = stats?.badges.find((b) => b.badgeId === badgeId);
            return (
              <View style={[styles.badge, !earned && styles.badgeLocked]}>
                <Text style={[styles.badgeEmoji, !earned && styles.badgeEmojiLocked]}>
                  {def.emoji}
                </Text>
                <Text style={styles.badgeLabel}>{def.label}</Text>
                <Text style={styles.badgeDesc}>{def.description}</Text>
                {earned && (
                  <Text style={styles.badgeDate}>
                    Earned {formatDate(earned.earnedAt)}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function StreakBanner({ stats }: { stats: UserStats }) {
  return (
    <View style={styles.streakBanner}>
      <View style={styles.streakItem}>
        <Text style={styles.streakNumber}>{stats.currentStreak}</Text>
        <Text style={styles.streakLabel}>Day streak 🔥</Text>
      </View>
      <View style={styles.streakDivider} />
      <View style={styles.streakItem}>
        <Text style={styles.streakNumber}>{stats.totalCheckIns}</Text>
        <Text style={styles.streakLabel}>Total visits</Text>
      </View>
      <View style={styles.streakDivider} />
      <View style={styles.streakItem}>
        <Text style={styles.streakNumber}>{stats.thisMonthCheckIns}</Text>
        <Text style={styles.streakLabel}>This month</Text>
      </View>
    </View>
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
  back: { color: COLORS.primary, fontSize: FONT_SIZE.md, marginBottom: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.textPrimary },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xxl },
  row: { gap: SPACING.sm },
  streakBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  streakItem: { flex: 1, alignItems: 'center' },
  streakNumber: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.primary },
  streakLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  streakDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  badge: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
    ...SHADOW.sm,
  },
  badgeLocked: { opacity: 0.4 },
  badgeEmoji: { fontSize: 36 },
  badgeEmojiLocked: { filter: 'grayscale(1)' } as any,
  badgeLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  badgeDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textAlign: 'center' },
  badgeDate: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600' },
});
