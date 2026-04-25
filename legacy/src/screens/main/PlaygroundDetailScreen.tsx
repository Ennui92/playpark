import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { FeedStackParamList, Playground, CheckIn } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { timeAgo, statusLabel, statusColor } from '@/utils/helpers';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Route = RouteProp<FeedStackParamList, 'PlaygroundDetail'>;

export function PlaygroundDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { playgroundId, playgroundName } = route.params;
  const { appUser } = useAuth();

  const [playground, setPlayground] = useState<Playground | null>(null);
  const [activeCheckIns, setActiveCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const pgSnap = await getDoc(doc(db, 'playgrounds', playgroundId));
      if (pgSnap.exists()) setPlayground({ id: playgroundId, ...pgSnap.data() } as Playground);

      const checkInSnap = await getDocs(
        query(
          collection(db, 'checkIns'),
          where('playgroundId', '==', playgroundId),
          where('expiresAt', '>', Timestamp.now())
        )
      );
      const list = checkInSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as CheckIn))
        .filter((c) => c.status !== 'left');
      setActiveCheckIns(list);
      setLoading(false);
    })();
  }, [playgroundId]);

  function handleCheckInHere() {
    navigation.navigate('CheckInTab', {
      screen: 'CheckInConfirm',
      params: { playgroundId, playgroundName },
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: SPACING.xxl }} color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛝 {playgroundName}</Text>
        {playground?.address && (
          <Text style={styles.headerAddress}>{playground.address}</Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsRow}>
          <Stat num={activeCheckIns.length} label="Here now" />
          <Stat num={playground?.totalVisits ?? 0} label="All-time visits" />
        </View>

        <Text style={styles.sectionLabel}>At the park now</Text>
        {activeCheckIns.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌳</Text>
            <Text style={styles.emptyText}>No one's checked in yet.</Text>
            <Text style={styles.emptySubtext}>Be the first!</Text>
          </View>
        ) : (
          activeCheckIns.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.personRow}
              onPress={() =>
                c.userId !== appUser?.uid &&
                navigation.navigate('FriendProfile', { userId: c.userId })
              }
            >
              <View style={styles.avatar}>
                {c.userAvatarUrl ? (
                  <Image source={{ uri: c.userAvatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarFallback}>
                    {c.userDisplayName.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{c.userDisplayName}</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor(c.status) }]} />
                  <Text style={[styles.statusText, { color: statusColor(c.status) }]}>
                    {statusLabel(c.status)} · {timeAgo(c.createdAt)}
                  </Text>
                </View>
                {c.children.length > 0 && (
                  <Text style={styles.children}>
                    With: {c.children.map((ch) => ch.name).join(', ')}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={styles.checkInButton} onPress={handleCheckInHere}>
          <Text style={styles.checkInButtonText}>📍 Check in here</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ num, label }: { num: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  headerAddress: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xxl },
  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  stat: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    ...SHADOW.sm,
  },
  statNum: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  empty: { alignItems: 'center', padding: SPACING.xl },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  emptySubtext: { fontSize: FONT_SIZE.sm, color: COLORS.textHint, marginTop: 4 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.primaryDark },
  personName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  children: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  checkInButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
    ...SHADOW.md,
  },
  checkInButtonText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
});
