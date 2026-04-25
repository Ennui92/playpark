import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FriendsStackParamList, Friendship } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getFriends, getPendingRequests } from '@/services/firebase/friendService';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Nav = NativeStackNavigationProp<FriendsStackParamList, 'FriendsList'>;

export function FriendsListScreen() {
  const navigation = useNavigation<Nav>();
  const { appUser } = useAuth();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    getFriends(appUser.uid).then((f) => {
      setFriends(f);
      setLoading(false);
    });
    getPendingRequests(appUser.uid)
      .then((r) => setPendingCount(r.length))
      .catch(() => {});
  }, [appUser]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.inboxButton}
            onPress={() => navigation.navigate('PendingRequests')}
          >
            <Text style={styles.inboxIcon}>📬</Text>
            {pendingCount > 0 && (
              <View style={styles.inboxBadge}>
                <Text style={styles.inboxBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddFriend')}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {pendingCount > 0 && (
        <TouchableOpacity
          style={styles.pendingBanner}
          onPress={() => navigation.navigate('PendingRequests')}
        >
          <Text style={styles.pendingBannerText}>
            ✨ {pendingCount} new friend {pendingCount === 1 ? 'request' : 'requests'} waiting
          </Text>
          <Text style={styles.pendingBannerCta}>Review →</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={friends}
        keyExtractor={(f) => f.friendUserId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptySubtitle}>
                Meet a parent at the playground and add them by scanning each other's QR code.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('AddFriend')}
              >
                <Text style={styles.emptyButtonText}>Add your first friend</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.friendCard}
            onPress={() =>
              navigation.navigate('FriendProfile', { userId: item.friendUserId })
            }
          >
            <View style={styles.avatar}>
              {item.friendAvatarUrl ? (
                <Image source={{ uri: item.friendAvatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarFallback}>
                  {item.friendDisplayName.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={styles.friendName}>{item.friendDisplayName}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.textPrimary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  inboxButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inboxIcon: { fontSize: 20 },
  inboxBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inboxBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.accentLight,
    padding: SPACING.md,
  },
  pendingBannerText: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, fontWeight: '700' },
  pendingBannerCta: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '700' },
  list: { padding: SPACING.md, gap: SPACING.sm },
  friendCard: {
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
  friendName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.textPrimary },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl, paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  emptyButtonText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
});
