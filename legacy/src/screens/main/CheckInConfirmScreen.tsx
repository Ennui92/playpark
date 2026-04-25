import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { CheckInStackParamList, Child, CheckInStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { createCheckIn } from '@/services/firebase/checkInService';
import { getChildren } from '@/services/firebase/profileService';
import { getFriends } from '@/services/firebase/friendService';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Route = RouteProp<CheckInStackParamList, 'CheckInConfirm'>;

export function CheckInConfirmScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { playgroundId, playgroundName } = route.params;
  const { appUser } = useAuth();

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [status, setStatus] = useState<CheckInStatus>('en_route');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingChildren, setLoadingChildren] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    getChildren(appUser.uid).then((c) => {
      setChildren(c);
      // Auto-select all children by default
      setSelectedChildIds(c.map((ch) => ch.id));
      setLoadingChildren(false);
    });
  }, [appUser]);

  function toggleChild(childId: string) {
    setSelectedChildIds((prev) =>
      prev.includes(childId) ? prev.filter((id) => id !== childId) : [...prev, childId]
    );
  }

  async function handleCheckIn() {
    if (!appUser) return;
    setLoading(true);
    try {
      const selectedChildren = children.filter((c) => selectedChildIds.includes(c.id));
      const [, friends] = await Promise.all([
        createCheckIn({
          userId: appUser.uid,
          userDisplayName: appUser.displayName,
          userAvatarUrl: appUser.avatarUrl,
          playgroundId,
          playgroundName,
          status,
          children: selectedChildren.map((c) => ({
            childId: c.id,
            name: c.name,
            photoUrl: c.photoUrl,
          })),
          message: message.trim() || null,
        }),
        getFriends(appUser.uid),
      ]);

      // Friends who actually got notified (exclude muted users — best-effort, client-side)
      const notifiedFriends = friends.map((f) => ({
        name: f.friendDisplayName,
        avatarUrl: f.friendAvatarUrl,
      }));

      // Pop confirm screen off stack, then show the success modal.
      navigation.goBack();
      const rootNav: any = navigation.getParent()?.getParent();
      rootNav?.navigate('CheckInSuccess', {
        playgroundName,
        status,
        notifiedFriends,
      });
    } catch {
      Alert.alert('Oops', 'Could not check in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{playgroundName}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status selector */}
        <Text style={styles.sectionLabel}>Your status</Text>
        <View style={styles.statusRow}>
          {(['en_route', 'arrived'] as CheckInStatus[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.statusChip, status === s && styles.statusChipActive]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.statusChipText, status === s && styles.statusChipTextActive]}>
                {s === 'en_route' ? '🚶 On the way' : '✅ Already there'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Child selector */}
        <Text style={styles.sectionLabel}>Who's coming?</Text>
        {loadingChildren ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : children.length === 0 ? (
          <Text style={styles.hint}>
            Add your children in Profile → My Children so friends can see who's coming.
          </Text>
        ) : (
          <View style={styles.childrenRow}>
            {children.map((child) => {
              const selected = selectedChildIds.includes(child.id);
              return (
                <TouchableOpacity
                  key={child.id}
                  style={[styles.childChip, selected && styles.childChipSelected]}
                  onPress={() => toggleChild(child.id)}
                >
                  <Text style={styles.childEmoji}>{child.emoji ?? '👧'}</Text>
                  <Text style={[styles.childName, selected && styles.childNameSelected]}>
                    {child.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Optional message */}
        <Text style={styles.sectionLabel}>Message (optional)</Text>
        <TextInput
          style={styles.messageInput}
          placeholder="e.g. Bringing snacks!"
          placeholderTextColor={COLORS.textHint}
          value={message}
          onChangeText={setMessage}
          maxLength={80}
        />

        {/* Check in button */}
        <TouchableOpacity
          style={[styles.checkInButton, loading && styles.checkInButtonDisabled]}
          onPress={handleCheckIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.checkInButtonText}>
              {status === 'en_route' ? '🚶 Heading to the park!' : '✅ I\'m at the park!'}
            </Text>
          )}
        </TouchableOpacity>
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
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
  },
  statusRow: { flexDirection: 'row', gap: SPACING.sm },
  statusChip: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  statusChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  statusChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  statusChipTextActive: { color: COLORS.primaryDark },
  childrenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  childChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  childEmoji: { fontSize: 18 },
  childName: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  childNameSelected: { color: COLORS.primaryDark },
  hint: { fontSize: FONT_SIZE.sm, color: COLORS.textHint },
  messageInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  checkInButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
    ...SHADOW.md,
  },
  checkInButtonDisabled: { opacity: 0.6 },
  checkInButtonText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
});
