import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Pressable } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "@/components/Button";
import { RootStackParamList } from "@/types";
import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/utils/theme";

type Nav = NativeStackNavigationProp<RootStackParamList, "BroadcastSuccess">;
type Route = RouteProp<RootStackParamList, "BroadcastSuccess">;

// Magic moment: the broadcast has been posted. The edge function is fanning out
// the pushes in the background. We celebrate here — spring burst, audience count
// counts up, dismiss by tap or auto-dismiss after 3s.

export function BroadcastSuccessScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { landmarkName, landmarkEmoji, audienceCount } = route.params;

  const scale = useRef(new Animated.Value(0.2)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const count = useRef(new Animated.Value(0)).current;
  const [displayCount, setDisplayCount] = React.useState(0);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Count-up — feels great, draws the eye.
    Animated.timing(count, {
      toValue: audienceCount,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const sub = count.addListener(({ value }) => setDisplayCount(Math.round(value)));
    const timer = setTimeout(() => nav.goBack(), 3500);
    return () => {
      count.removeListener(sub);
      clearTimeout(timer);
    };
  }, [audienceCount, count, scale, opacity, nav]);

  return (
    <Pressable style={styles.backdrop} onPress={() => nav.goBack()}>
      <Animated.View
        style={[styles.card, { transform: [{ scale }], opacity }]}
        onStartShouldSetResponder={() => true}
      >
        <Text style={styles.emoji}>{landmarkEmoji}</Text>
        <Text style={styles.title}>You're broadcasting</Text>
        <Text style={styles.spot}>{landmarkName}</Text>

        <View style={styles.divider} />

        {audienceCount > 0 ? (
          <>
            <Text style={styles.count}>{displayCount}</Text>
            <Text style={styles.countLabel}>
              friend {audienceCount === 1 ? "family" : "families"} just got a ping
            </Text>
          </>
        ) : (
          <Text style={styles.countLabel}>
            No subscribers yet — add friends so they'll see you next time.
          </Text>
        )}

        <Button title="Done" onPress={() => nav.goBack()} style={{ marginTop: SPACING.lg }} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: "center",
  },
  emoji: { fontSize: 72 },
  title: {
    fontSize: FONT_SIZE.md,
    color: COLORS.ever,
    fontWeight: "700",
    marginTop: SPACING.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  spot: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: "800",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginTop: SPACING.xs,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    alignSelf: "stretch",
    marginVertical: SPACING.lg,
  },
  count: {
    fontSize: 64,
    fontWeight: "800",
    color: COLORS.accent,
    lineHeight: 72,
  },
  countLabel: { color: COLORS.textSecondary, textAlign: "center", marginTop: SPACING.xs },
});
