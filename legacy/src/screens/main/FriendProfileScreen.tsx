import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { FeedStackParamList, User, CheckIn } from '@/types';
import { timeAgo, statusLabel, statusColor } from '@/utils/helpers';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Route = RouteProp<FeedStackParamList, 'FriendProfile'>;

export function FriendProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { userId } = route.params;

  const [friend, setFriend] = useState<User | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) setFriend({ uid: userId, ...snap.data() } as User);

      const checkInSnap = await getDocs(
        query(
          collection(db, 'checkIns'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(5)
        )
      );
      setRecentCheckIns(
        checkInSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CheckIn))
      );
      setLoading(false);
    })();
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: SPACING.xxl }} color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!friend) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.notFound}>Friend not found.</Text>
      </SafeAreaView>
    );
  }

  const activeCheckIn = recentCheckIns.find((c) => c.status !== 'left');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroAvatar}>
            {friend.avatarUrl ? (
              <Image source={{ uri: friend.avatarUrl }} style={styles.heroAvatarImage} />
            ) : (
              <Text style={styles.heroAvatarFallback}>
                {friend.displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={styles.name}>{friend.displayName}</Text>

          {activeCheckIn ? (
            <View style={[styles.statusPill, { backgroundColor: statusColor(activeCheckIn.status) }]}>
              <Text style={styles.statusPillText}>
                {statusLabel(activeCheckIn.status)} at {activeCheckIn.playgroundName}
              </Text>
            </View>
          ) : (
            <Text style={styles.statusIdle}>Not at a park right now</Text>
          )}
        </View>

        <Text style={styles.sectionLabel}>Recent check-ins</Text>
        {recentCheckIns.length === 0 ? (
          <Text style={styles.empty}>No recent check-ins yet.</Text>
        ) : (
          recentCheckIns.map((c) => (
            <View key={c.id} style={styles.historyRow}>
              <Text style={styles.historyPark}>🛝 {c.playgroundName}</Text>
              <Text style={styles.historyTime}>{timeAgo(c.createdAt)}</Text>
            </View>
          ))
        )}
      </ScrollView>
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
  back: { color: COLORS.primary, fontSize: FONT_SIZE.md },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  notFound: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xxl },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOW.md,
  },
  heroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  heroAvatarImage: { width: '100%', height: '100%' },
  heroAvatarFallback: {
    fontSize: FONT_SIZE.hero,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  name: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  statusPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  statusPillText: { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: '700' },
  statusIdle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.md,
  },
  empty: { fontSize: FONT_SIZE.sm, color: COLORS.textHint, fontStyle: 'italic' },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  historyPark: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  historyTime: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
});
