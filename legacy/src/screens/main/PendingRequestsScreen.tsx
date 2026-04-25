import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { getPendingRequests, acceptFriendRequest, declineFriendRequest } from '@/services/firebase/friendService';
import { FriendRequest } from '@/types';
import { timeAgo } from '@/utils/helpers';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

export function PendingRequestsScreen() {
  const navigation = useNavigation();
  const { appUser } = useAuth();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!appUser) return;
    const list = await getPendingRequests(appUser.uid);
    setRequests(list);
    setLoading(false);
    setRefreshing(false);
  }, [appUser]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAccept(req: FriendRequest) {
    setActingOn(req.id);
    try {
      await acceptFriendRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch {
      Alert.alert('Oops', 'Could not accept. Please try again.');
    } finally {
      setActingOn(null);
    }
  }

  function handleDecline(req: FriendRequest) {
    Alert.alert('Decline request?', `${req.fromDisplayName} won't be notified.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setActingOn(req.id);
          // Optimistic remove — if the server call fails, we still hide it locally.
          setRequests((prev) => prev.filter((r) => r.id !== req.id));
          try {
            await declineFriendRequest(req.id);
          } catch {
            // Silent — decline is best-effort
          } finally {
            setActingOn(null);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friend requests</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xxl }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySubtitle}>
                When another parent scans your QR code, their request will show up here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                {item.fromAvatarUrl ? (
                  <Image source={{ uri: item.fromAvatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarFallback}>
                    {item.fromDisplayName.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.fromDisplayName}</Text>
                <Text style={styles.time}>Sent {timeAgo(item.createdAt)}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(item)}>
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.acceptBtn, actingOn === item.id && styles.btnDisabled]}
                  onPress={() => handleAccept(item)}
                  disabled={actingOn === item.id}
                >
                  {actingOn === item.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
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
  back: { color: COLORS.primary, fontSize: FONT_SIZE.md, marginBottom: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.textPrimary },
  list: { padding: SPACING.md, gap: SPACING.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.primaryDark },
  name: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary },
  time: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: SPACING.xs },
  acceptBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },
  declineBtn: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  declineBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: FONT_SIZE.sm },
  btnDisabled: { opacity: 0.6 },
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
