import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ProfileStackParamList } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { addChild, updateChild, deleteChild, getChild } from '@/services/firebase/profileService';
import { Timestamp } from 'firebase/firestore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '@/utils/theme';

type Route = RouteProp<ProfileStackParamList, 'EditChild'>;

const EMOJI_OPTIONS = ['👧', '👦', '🧒', '👶', '🌟', '🦁', '🐻', '🐼', '🦊', '🐸'];

export function AddEditChildScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const isEditing = !!route.params?.childId;
  const { appUser } = useAuth();

  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('👧');
  const [loading, setLoading] = useState(false);
  const [loadingChild, setLoadingChild] = useState(isEditing);

  useEffect(() => {
    if (!isEditing || !appUser) return;
    getChild(appUser.uid, route.params.childId).then((child) => {
      if (!child) return;
      setName(child.name);
      const d = child.birthDate.toDate();
      setBirthYear(String(d.getFullYear()));
      setBirthMonth(String(d.getMonth() + 1));
      setSelectedEmoji(child.emoji ?? '👧');
      setLoadingChild(false);
    });
  }, []);

  async function handleSave() {
    if (!appUser) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your child\'s name.');
      return;
    }
    const year = parseInt(birthYear, 10);
    const month = parseInt(birthMonth, 10);
    if (!year || !month || year < 2015 || year > new Date().getFullYear() || month < 1 || month > 12) {
      Alert.alert('Invalid date', 'Please enter a valid birth year and month.');
      return;
    }

    setLoading(true);
    const birthDate = Timestamp.fromDate(new Date(year, month - 1, 1));

    try {
      if (isEditing) {
        await updateChild(appUser.uid, route.params.childId, { name: name.trim(), birthDate, emoji: selectedEmoji });
      } else {
        await addChild(appUser.uid, { name: name.trim(), birthDate, emoji: selectedEmoji, photoUrl: null });
      }
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!appUser || !isEditing) return;
    Alert.alert('Remove child?', `Remove ${name} from your profile?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteChild(appUser.uid, route.params.childId);
          navigation.goBack();
        },
      },
    ]);
  }

  if (loadingChild) {
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
        <Text style={styles.headerTitle}>{isEditing ? 'Edit child' : 'Add a child'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Emma"
          placeholderTextColor={COLORS.textHint}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Birth year</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2022"
          placeholderTextColor={COLORS.textHint}
          keyboardType="numeric"
          maxLength={4}
          value={birthYear}
          onChangeText={setBirthYear}
        />

        <Text style={styles.label}>Birth month (1–12)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 3"
          placeholderTextColor={COLORS.textHint}
          keyboardType="numeric"
          maxLength={2}
          value={birthMonth}
          onChangeText={setBirthMonth}
        />

        <Text style={styles.label}>Avatar emoji</Text>
        <View style={styles.emojiRow}>
          {EMOJI_OPTIONS.map((e) => (
            <TouchableOpacity
              key={e}
              style={[styles.emojiOption, selectedEmoji === e && styles.emojiOptionSelected]}
              onPress={() => setSelectedEmoji(e)}
            >
              <Text style={styles.emojiText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{isEditing ? 'Save changes' : 'Add child'}</Text>
          )}
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Remove this child</Text>
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
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  emojiOption: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  emojiOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  emojiText: { fontSize: 24 },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
  deleteButton: { padding: SPACING.md, alignItems: 'center' },
  deleteButtonText: { color: COLORS.error, fontSize: FONT_SIZE.md },
});
