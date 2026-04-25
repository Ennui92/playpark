import React, { useState } from 'react';
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
  Share,
} from 'react-native';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { addChild } from '@/services/firebase/profileService';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

const EMOJI_OPTIONS = ['👧', '👦', '🧒', '👶', '🦁', '🐻', '🦊', '🐸'];

type Step = 'welcome' | 'child' | 'friends' | 'ready';

export function OnboardingScreen() {
  const { appUser, refreshAppUser } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [childName, setChildName] = useState('');
  const [childEmoji, setChildEmoji] = useState('👧');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [saving, setSaving] = useState(false);

  async function finishOnboarding() {
    if (!appUser) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', appUser.uid), { hasOnboarded: true });
      await refreshAppUser();
    } catch {
      Alert.alert('Oops', 'Could not finish setup. Try again.');
      setSaving(false);
    }
  }

  async function handleSaveChild() {
    if (!appUser) return;
    if (!childName.trim()) {
      Alert.alert('Name required', "Enter your child's name.");
      return;
    }
    const year = parseInt(birthYear, 10);
    const month = parseInt(birthMonth, 10);
    if (!year || !month || year < 2015 || year > new Date().getFullYear() || month < 1 || month > 12) {
      Alert.alert('Invalid date', 'Enter a valid birth year and month.');
      return;
    }
    setSaving(true);
    try {
      await addChild(appUser.uid, {
        name: childName.trim(),
        birthDate: Timestamp.fromDate(new Date(year, month - 1, 1)),
        emoji: childEmoji,
        photoUrl: null,
      });
      setSaving(false);
      setStep('friends');
    } catch {
      Alert.alert('Error', 'Could not save child.');
      setSaving(false);
    }
  }

  async function handleInviteFriends() {
    try {
      await Share.share({
        message: `Let's use PlayPark to know when we're at the playground! Download it and add me as a friend.`,
      });
    } catch {
      // user cancelled — no-op
    }
  }

  // ── Step screens ─────────────────────────────────────────────────────────

  if (step === 'welcome') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ProgressDots current={0} />
          <Text style={styles.heroEmoji}>🛝</Text>
          <Text style={styles.title}>Welcome, {appUser?.displayName.split(' ')[0] ?? 'friend'}!</Text>
          <Text style={styles.subtitle}>
            PlayPark helps you turn playground trips into spontaneous playdates with parent friends nearby.
          </Text>

          <View style={styles.featureList}>
            <Feature emoji="📍" title="Check in" body="Tell friends you're heading to a park" />
            <Feature emoji="🔔" title="Get notified" body="When friends are at a park nearby" />
            <Feature emoji="🤝" title="Meet up" body="Turn trips into playdates" />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('child')}>
            <Text style={styles.primaryButtonText}>Let's set you up</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'child') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ProgressDots current={1} />
          <Text style={styles.stepLabel}>Step 1 of 2</Text>
          <Text style={styles.title}>Add your first child</Text>
          <Text style={styles.subtitle}>
            Friends will see who's coming when you check in. You can add more later.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Emma"
              placeholderTextColor={COLORS.textHint}
              value={childName}
              onChangeText={setChildName}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Birth year</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2022"
                  placeholderTextColor={COLORS.textHint}
                  keyboardType="numeric"
                  maxLength={4}
                  value={birthYear}
                  onChangeText={setBirthYear}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Month (1–12)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="3"
                  placeholderTextColor={COLORS.textHint}
                  keyboardType="numeric"
                  maxLength={2}
                  value={birthMonth}
                  onChangeText={setBirthMonth}
                />
              </View>
            </View>

            <Text style={styles.label}>Pick an avatar</Text>
            <View style={styles.emojiRow}>
              {EMOJI_OPTIONS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiOption, childEmoji === e && styles.emojiOptionSelected]}
                  onPress={() => setChildEmoji(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSaveChild}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Continue</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep('friends')}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'friends') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ProgressDots current={2} />
          <Text style={styles.stepLabel}>Step 2 of 2</Text>
          <Text style={styles.title}>Add parent friends</Text>
          <Text style={styles.subtitle}>
            PlayPark works best with friends. Invite a few now — you can always add more.
          </Text>

          <View style={styles.tip}>
            <Text style={styles.tipEmoji}>💡</Text>
            <Text style={styles.tipText}>
              After signup, share a QR code at the playground to instantly connect with other parents.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleInviteFriends}>
            <Text style={styles.primaryButtonText}>📱 Invite friends</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('ready')}>
            <Text style={styles.secondaryButtonText}>I'll do this later</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ready
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heroEmoji}>🎉</Text>
        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.subtitle}>
          Next time you head to a playground, tap the green check-in button and your friends will know.
        </Text>

        <View style={styles.nextStepsCard}>
          <Text style={styles.nextStepsTitle}>What's next</Text>
          <NextStep num="1" text="Head to a playground" />
          <NextStep num="2" text="Tap the 📍 check-in button" />
          <NextStep num="3" text="Meet up with parent friends!" />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={finishOnboarding}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Start exploring</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Feature({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureBody}>{body}</Text>
      </View>
    </View>
  );
}

function NextStep({ num, text }: { num: string; text: string }) {
  return (
    <View style={styles.nextStep}>
      <View style={styles.nextStepNum}>
        <Text style={styles.nextStepNumText}>{num}</Text>
      </View>
      <Text style={styles.nextStepText}>{text}</Text>
    </View>
  );
}

function ProgressDots({ current }: { current: number }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[styles.dot, i === current && styles.dotActive, i < current && styles.dotDone]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  dots: { flexDirection: 'row', gap: SPACING.xs, justifyContent: 'center', marginTop: SPACING.md, marginBottom: SPACING.xl },
  dot: { width: 24, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.primary, width: 32 },
  dotDone: { backgroundColor: COLORS.primaryLight },
  heroEmoji: { fontSize: 72, textAlign: 'center', marginBottom: SPACING.md },
  stepLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  featureList: { gap: SPACING.md, marginBottom: SPACING.xl },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  featureEmoji: { fontSize: 32 },
  featureTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textPrimary },
  featureBody: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  form: { gap: SPACING.sm, marginBottom: SPACING.lg },
  row: { flexDirection: 'row', gap: SPACING.sm },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
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
  tip: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  tipEmoji: { fontSize: 24 },
  tipText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, lineHeight: 20 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
    ...SHADOW.md,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
  secondaryButton: {
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  secondaryButtonText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md, fontWeight: '600' },
  skipText: {
    textAlign: 'center',
    color: COLORS.textHint,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.md,
  },
  nextStepsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOW.sm,
  },
  nextStepsTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  nextStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextStepNumText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },
  nextStepText: { fontSize: FONT_SIZE.md, color: COLORS.textPrimary, flex: 1 },
});
