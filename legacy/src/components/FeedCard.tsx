import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { FeedEntry } from '@/types';
import { timeAgo, statusLabel, statusColor } from '@/utils/helpers';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

interface Props {
  entry: FeedEntry;
  currentUserId: string;
  onConfirm: () => void;
  onPress?: () => void;
  onPressUser?: () => void;
  onPressPlayground?: () => void;
}

export function FeedCard({ entry, currentUserId, onConfirm, onPress, onPressUser, onPressPlayground }: Props) {
  const hasConfirmed = entry.confirmedBy.includes(currentUserId);
  const color = statusColor(entry.status);

  return (
    <TouchableOpacity activeOpacity={onPress ? 0.7 : 1} onPress={onPress} style={styles.card}>
      {/* Status indicator bar */}
      <View style={[styles.statusBar, { backgroundColor: color }]} />

      <View style={styles.body}>
        {/* Top row: avatar + name + time */}
        <TouchableOpacity
          activeOpacity={onPressUser ? 0.7 : 1}
          onPress={onPressUser}
          style={styles.topRow}
        >
          <View style={styles.avatar}>
            {entry.userAvatarUrl ? (
              <Image source={{ uri: entry.userAvatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarFallback}>
                {entry.userDisplayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{entry.userDisplayName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: color }]} />
              <Text style={[styles.statusText, { color }]}>
                {statusLabel(entry.status)}
              </Text>
            </View>
          </View>

          <Text style={styles.time}>{timeAgo(entry.createdAt)}</Text>
        </TouchableOpacity>

        {/* Playground name */}
        <TouchableOpacity activeOpacity={onPressPlayground ? 0.7 : 1} onPress={onPressPlayground}>
          <Text style={styles.playgroundName}>🛝 {entry.playgroundName}</Text>
        </TouchableOpacity>

        {/* Children */}
        {entry.children.length > 0 && (
          <View style={styles.childrenRow}>
            {entry.children.map((child) => (
              <View key={child.childId} style={styles.childChip}>
                <Text style={styles.childEmoji}>
                  {child.photoUrl ? '' : '👧'}
                </Text>
                <Text style={styles.childName}>{child.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Optional message */}
        {entry.message ? (
          <Text style={styles.message}>"{entry.message}"</Text>
        ) : null}

        {/* Footer: confirmations + CTA */}
        {entry.status !== 'left' && (
          <View style={styles.footer}>
            {entry.confirmedBy.length > 0 && (
              <Text style={styles.confirmCount}>
                {entry.confirmedBy.length} joining
              </Text>
            )}
            <TouchableOpacity
              style={[styles.confirmButton, hasConfirmed && styles.confirmButtonDone]}
              onPress={onConfirm}
              disabled={hasConfirmed}
            >
              <Text style={[styles.confirmButtonText, hasConfirmed && styles.confirmButtonTextDone]}>
                {hasConfirmed ? "✓ I'll be there" : "I'll be there!"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  statusBar: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  userName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  time: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textHint,
  },
  playgroundName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  childrenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  childEmoji: { fontSize: 12 },
  childName: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  message: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  confirmCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  confirmButtonDone: {
    backgroundColor: COLORS.primaryLight,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  confirmButtonTextDone: {
    color: COLORS.primaryDark,
  },
});
