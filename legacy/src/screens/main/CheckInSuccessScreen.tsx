import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/types';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Route = RouteProp<RootStackParamList, 'CheckInSuccess'>;

export function CheckInSuccessScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { playgroundName, status, notifiedFriends } = route.params;

  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const avatarStaggers = useRef(notifiedFriends.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.stagger(
      80,
      avatarStaggers.map((val) =>
        Animated.spring(val, { toValue: 1, friction: 5, useNativeDriver: true })
      )
    ).start();
  }, []);

  const headline =
    status === 'en_route' ? "You're on the way!" : "You're at the park!";
  const subline =
    notifiedFriends.length === 0
      ? 'Once you add friends, they\'ll know when you\'re out.'
      : notifiedFriends.length === 1
      ? `${notifiedFriends[0].name} just got a notification.`
      : `${notifiedFriends.length} friends just got a notification.`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <Animated.View style={[styles.burst, { transform: [{ scale }], opacity }]}>
          <Text style={styles.burstEmoji}>{status === 'en_route' ? '🚶' : '🎉'}</Text>
        </Animated.View>

        <Text style={styles.title}>{headline}</Text>
        <Text style={styles.playground}>🛝 {playgroundName}</Text>
        <Text style={styles.subline}>{subline}</Text>

        {notifiedFriends.length > 0 && (
          <View style={styles.avatarRow}>
            {notifiedFriends.slice(0, 6).map((f, idx) => (
              <Animated.View
                key={idx}
                style={[
                  styles.avatarWrap,
                  {
                    transform: [
                      {
                        scale: avatarStaggers[idx].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1],
                        }),
                      },
                    ],
                    opacity: avatarStaggers[idx],
                  },
                ]}
              >
                <View style={styles.avatar}>
                  {f.avatarUrl ? (
                    <Image source={{ uri: f.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarFallback}>
                      {f.name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.avatarName} numberOfLines={1}>
                  {f.name.split(' ')[0]}
                </Text>
              </Animated.View>
            ))}
            {notifiedFriends.length > 6 && (
              <View style={styles.avatarWrap}>
                <View style={[styles.avatar, styles.avatarMore]}>
                  <Text style={styles.avatarMoreText}>+{notifiedFriends.length - 6}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.doneButtonText}>See who joins</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  burst: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    ...SHADOW.md,
  },
  burstEmoji: { fontSize: 72 },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  playground: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  subline: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  avatarWrap: { alignItems: 'center', width: 56 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primaryDark },
  avatarMore: { backgroundColor: COLORS.border },
  avatarMoreText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.textSecondary },
  avatarName: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    ...SHADOW.md,
  },
  doneButtonText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
});
