import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfileStackParamList, Child } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getChildren } from '@/services/firebase/profileService';
import { ageFromBirthDate } from '@/utils/helpers';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'ChildrenList'>;

export function ChildrenListScreen() {
  const navigation = useNavigation<Nav>();
  const { appUser } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser) return;
    getChildren(appUser.uid).then((c) => {
      setChildren(c);
      setLoading(false);
    });
  }, [appUser]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My children</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddChild')}>
          <Text style={styles.addButton}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: SPACING.xxl }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={children}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>👶</Text>
              <Text style={styles.emptyTitle}>Add your children</Text>
              <Text style={styles.emptyText}>
                So friends can see who's coming to the playground!
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('AddChild')}
              >
                <Text style={styles.emptyButtonText}>Add a child</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.childCard}
              onPress={() => navigation.navigate('EditChild', { childId: item.id })}
            >
              <View style={styles.childAvatar}>
                {item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={styles.childPhoto} />
                ) : (
                  <Text style={styles.childEmoji}>{item.emoji ?? '👧'}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.childName}>{item.name}</Text>
                <Text style={styles.childAge}>{ageFromBirthDate(item.birthDate)} old</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  back: { color: COLORS.primary, fontSize: FONT_SIZE.md, flex: 1 },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.textPrimary },
  addButton: { color: COLORS.primary, fontSize: FONT_SIZE.md, fontWeight: '700', flex: 1, textAlign: 'right' },
  list: { padding: SPACING.md, gap: SPACING.sm },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  childAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  childPhoto: { width: '100%', height: '100%' },
  childEmoji: { fontSize: 28 },
  childName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary },
  childAge: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  chevron: { fontSize: 20, color: COLORS.textHint },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl, paddingHorizontal: SPACING.xl, gap: SPACING.md },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.textPrimary },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center' },
  emptyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  emptyButtonText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
});
