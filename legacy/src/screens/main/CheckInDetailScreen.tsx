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
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { FeedStackParamList, CheckIn } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { confirmPlaydate } from '@/services/firebase/checkInService';
import { timeAgo, statusLabel, statusColor, formatTime } from '@/utils/helpers';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Route = RouteProp<FeedStackParamList, 'CheckInDetail'>;

export function CheckInDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { checkInId } = route.params;
  const { appUser } = useAuth();

  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'checkIns', checkInId), (snap) => {
      if (snap.exists()) setCheckIn({ id: snap.id, ...snap.data() } as CheckIn);
      setLoading(false);
    });
    return unsub;
  }, [checkInId]);

  async function handleConfirm() {
    if (!appUser || !checkIn) return;
    setConfirming(true);
    try {
      await confirmPlaydate(checkIn.id, appUser.uid);
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: SPACING.xxl }} color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!checkIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.notFound}>Check-in not found or expired.</Text>
      </SafeAreaView>
    );
  }

  const isMine = checkIn.userId === appUser?.uid;
  const hasConfirmed = appUser && checkIn.confirmedBy.includes(appUser.uid);
  const color = statusColor(checkIn.status);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Check-in</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Who */}
        <TouchableOpacity
          style={styles.userCard}
          disabled={isMine}
          onPress={() => navigation.navigate('FriendProfile', { userId: checkIn.userId })}
        >
          <View style={styles.avatar}>
            {checkIn.userAvatarUrl ? (
              <Image source={{ uri: checkIn.userAvatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarFallback}>
                {checkIn.userDisplayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{checkIn.userDisplayName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: color }]} />
              <Text style={[styles.statusText, { color }]}>
                {statusLabel(checkIn.status)} · {timeAgo(checkIn.createdAt)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Where */}
        <TouchableOpacity
          style={styles.parkCard}
          onPress={() =>
            navigation.navigate('PlaygroundDetail', {
              playgroundId: checkIn.playgroundId,
              playgroundName: checkIn.playgroundName,
            })
          }
        >
          <Text style={styles.parkEmoji}>🛝</Text>
          <Text style={styles.parkName}>{checkIn.playgroundName}</Text>
          <Text style={styles.parkChevron}>›</Text>
        </TouchableOpacity>

        {/* Children */}
        {checkIn.children.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Who's coming</Text>
            <View style={styles.childrenRow}>
              {checkIn.children.map((ch) => (
                <View key={ch.childId} style={styles.childChip}>
                  <Text style={styles.childEmoji}>👧</Text>
                  <Text style={styles.childName}>{ch.name}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Message */}
        {checkIn.message && (
          <>
            <Text style={styles.sectionLabel}>Message</Text>
            <View style={styles.messageBubble}>
              <Text style={styles.messageText}>"{checkIn.message}"</Text>
            </View>
          </>
        )}

        {/* Times */}
        <Text style={styles.sectionLabel}>Timeline</Text>
        <View style={styles.timelineCard}>
          <Text style={styles.timelineItem}>
            Checked in · {formatTime(checkIn.createdAt)}
          </Text>
          {checkIn.arrivedAt && (
            <Text style={styles.timelineItem}>
              Arrived · {formatTime(checkIn.arrivedAt)}
            </Text>
          )}
          {checkIn.leftAt && (
            <Text style={styles.timelineItem}>
              Left · {formatTime(checkIn.leftAt)}
            </Text>
          )}
        </View>

        {/* Confirmations */}
        <Text style={styles.sectionLabel}>
          {checkIn.confirmedBy.length} joining
        </Text>

        {/* CTA */}
        {!isMine && checkIn.status !== 'left' && (
          <TouchableOpacity
            style={[styles.confirmButton, hasConfirmed && styles.confirmButtonDone]}
            onPress={handleConfirm}
            disabled={hasConfirmed || confirming}
          >
            {confirming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.confirmButtonText, hasConfirmed && styles.confirmButtonTextDone]}>
                {hasConfirmed ? "✓ You're joining!" : "I'll be there!"}
              </Text>
            )}
          </TouchableOpacity>
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
  back: { color: COLORS.primary, fontSize: FONT_SIZE.md, marginBottom: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.textPrimary },
  content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xxl },
  notFound: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xxl },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.primaryDark },
  userName: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  parkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  parkEmoji: { fontSize: 28 },
  parkName: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary },
  parkChevron: { fontSize: 22, color: COLORS.textHint },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.md,
  },
  childrenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  childEmoji: { fontSize: 14 },
  childName: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, fontWeight: '600' },
  messageBubble: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  messageText: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, fontStyle: 'italic' },
  timelineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs,
    ...SHADOW.sm,
  },
  timelineItem: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
    ...SHADOW.md,
  },
  confirmButtonDone: { backgroundColor: COLORS.primaryLight },
  confirmButtonText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
  confirmButtonTextDone: { color: COLORS.primaryDark },
});
