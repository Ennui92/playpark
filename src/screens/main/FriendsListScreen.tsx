import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ToastAndroid,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FriendsStackParamList, Friendship } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getFriends } from '@/services/firebase/friendService';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Nav = NativeStackNavigationProp<FriendsStackParamList, 'FriendsList'>;

export function FriendsListScreen() {
  const navigation = useNavigation<Nav>();
  const { appUser } = useAuth();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!appUser) return;
    getFriends(appUser.uid).then((f) => {
      setFriends(f);
      setLoading(false);
    });
  }, [appUser]);

  async function copyMyName() {
    if (!appUser) return;
    await Clipboard.setStringAsync(appUser.displayName);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Name copied', ToastAndroid.SHORT);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddFriend')}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={friends}
        keyExtractor={(f) => f.friendUserId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          appUser ? (
            <TouchableOpacity
              style={styles.myNameCard}
              onPress={copyMyName}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.myNameLabel}>Your family name</Text>
                <Text style={styles.myNameValue}>{appUser.displayName}</Text>
              </View>
              <View style={styles.copyPill}>
                <Text style={styles.copyPillText}>{copied ? 'Copied!' : 'Copy'}</Text>
              </View>
            </TouchableOpacity>
          ) : null
        }
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
          <View style={styles.friendCard}>
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
          </View>
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
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
  list: { padding: SPACING.md, gap: SPACING.sm },
  myNameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  myNameLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primaryDark,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  myNameValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  copyPill: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  copyPillText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },
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
