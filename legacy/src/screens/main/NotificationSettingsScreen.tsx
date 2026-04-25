import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { endOfTodayTimestamp, isNotificationMuted } from '@/utils/helpers';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';
import { Timestamp } from 'firebase/firestore';

export function NotificationSettingsScreen() {
  const navigation = useNavigation();
  const { appUser, refreshAppUser } = useAuth();

  if (!appUser) return null;

  const isMuted = isNotificationMuted(appUser.notificationPrefs.mutedUntil);
  const notificationsEnabled = appUser.notificationPrefs.enabled;

  async function toggleNotifications(value: boolean) {
    await updateDoc(doc(db, 'users', appUser!.uid), {
      'notificationPrefs.enabled': value,
    });
    await refreshAppUser();
  }

  async function muteToday() {
    await updateDoc(doc(db, 'users', appUser!.uid), {
      'notificationPrefs.mutedUntil': endOfTodayTimestamp(),
    });
    await refreshAppUser();
    Alert.alert('Muted for today', 'Notifications will resume tomorrow morning.');
  }

  async function unmute() {
    await updateDoc(doc(db, 'users', appUser!.uid), {
      'notificationPrefs.mutedUntil': null,
    });
    await refreshAppUser();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Friend check-in alerts</Text>
              <Text style={styles.rowHint}>Get notified when a friend heads to the park</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ true: COLORS.primary }}
            />
          </View>
        </View>

        {notificationsEnabled && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quick mute</Text>
            </View>

            {isMuted ? (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Muted for today</Text>
                  <Text style={styles.rowHint}>Notifications resume tomorrow</Text>
                </View>
                <TouchableOpacity style={styles.unmuteButton} onPress={unmute}>
                  <Text style={styles.unmuteButtonText}>Unmute</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[styles.row, styles.actionRow]} onPress={muteToday}>
                <Text style={styles.rowLabel}>Mute for today</Text>
                <Text style={styles.rowHint}>
                  Silence alerts on days you know you're not going out
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.tip}>
          💡 Tip: Tap the bell icon on the Feed screen to quickly mute/unmute for the day.
        </Text>
      </View>
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
  content: { padding: SPACING.md, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  sectionHeader: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  actionRow: { flexDirection: 'column', alignItems: 'flex-start' },
  rowLabel: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, fontWeight: '600' },
  rowHint: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  unmuteButton: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  unmuteButtonText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: FONT_SIZE.sm },
  tip: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    paddingHorizontal: SPACING.xs,
  },
});
