import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@/types';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '@/utils/theme';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
};

export function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🛝</Text>
        <Text style={styles.title}>PlayPark</Text>
        <Text style={styles.tagline}>
          Spontaneous playground meet-ups{'\n'}with parent friends
        </Text>
      </View>

      <View style={styles.features}>
        <Feature emoji="📍" text="Check in to your playground in one tap" />
        <Feature emoji="🔔" text="Get notified when friends are heading out" />
        <Feature emoji="👧" text="Remember each other's kids by name" />
        <Feature emoji="🤝" text="Add parents nearby with a QR scan" />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={styles.primaryButtonText}>Get started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.secondaryButtonText}>I already have an account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Feature({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
  },
  hero: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  heroEmoji: {
    fontSize: 72,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.hero,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  features: {
    flex: 1,
    justifyContent: 'center',
    gap: SPACING.md,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  actions: {
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    padding: SPACING.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  secondaryButton: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
  },
});
