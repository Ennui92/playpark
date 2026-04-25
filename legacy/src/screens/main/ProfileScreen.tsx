import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { appUser, signOut } = useAuth();

  if (!appUser) return null;

  function handleSignOut() {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {appUser.avatarUrl ? (
              <Image source={{ uri: appUser.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetter}>
                  {appUser.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.displayName}>{appUser.displayName}</Text>
          <Text style={styles.friendCount}>{appUser.friendCount} park friends</Text>
        </View>

        {/* Menu sections */}
        <MenuSection title="My family">
          <MenuItem
            emoji="👧"
            label="My children"
            onPress={() => navigation.navigate('ChildrenList')}
          />
        </MenuSection>

        <MenuSection title="Activity">
          <MenuItem
            emoji="🏆"
            label="Badges & streaks"
            onPress={() => navigation.navigate('Badges')}
          />
        </MenuSection>

        <MenuSection title="Settings">
          <MenuItem
            emoji="🔔"
            label="Notification settings"
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <MenuItem
            emoji="🚪"
            label="Sign out"
            onPress={handleSignOut}
            destructive
          />
        </MenuSection>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function MenuItem({
  emoji,
  label,
  onPress,
  destructive = false,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuEmoji}>{emoji}</Text>
      <Text style={[styles.menuLabel, destructive && styles.menuLabelDestructive]}>{label}</Text>
      {!destructive && <Text style={styles.menuChevron}>›</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOW.sm,
  },
  avatarContainer: { marginBottom: SPACING.md },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.primaryDark },
  displayName: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.textPrimary },
  friendCount: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },
  section: { gap: SPACING.xs },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.xs,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuEmoji: { fontSize: 20, marginRight: SPACING.md },
  menuLabel: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.textPrimary },
  menuLabelDestructive: { color: COLORS.error },
  menuChevron: { fontSize: 20, color: COLORS.textHint },
});
