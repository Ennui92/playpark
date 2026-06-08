import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "@/components/Button";
import { Landmark, RootStackParamList } from "@/types";
import { getLandmarkById } from "@/services/landmarks";
import { createBroadcast } from "@/services/broadcasts";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/config/supabase";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

type Nav = NativeStackNavigationProp<RootStackParamList, "BroadcastCompose">;
type Route = RouteProp<RootStackParamList, "BroadcastCompose">;

// Simple relative-time chips rather than a full picker — 1 tap = broadcast.
const TIME_OPTIONS = [
  { label: "Now", minutes: 0 },
  { label: "In 15 min", minutes: 15 },
  { label: "In 30 min", minutes: 30 },
  { label: "In 1 hr", minutes: 60 },
];

export function BroadcastComposeScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { landmarkId } = route.params;
  const { family } = useSession();

  const [landmark, setLandmark] = useState<Landmark | null>(null);
  const [minutesFromNow, setMinutesFromNow] = useState(0);
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    getLandmarkById(landmarkId).then(setLandmark);
  }, [landmarkId]);

  async function broadcast() {
    if (!family || !landmark) return;
    setPosting(true);
    try {
      const plannedAt = new Date(Date.now() + minutesFromNow * 60_000);
      await createBroadcast({
        familyId: family.id,
        landmarkId,
        plannedAt,
        message: message.trim() || null,
      });

      // Best-effort audience count (for the success animation). Friends of this
      // family who are subscribed to this landmark.
      const count = await estimateAudience(family.id, landmarkId);

      nav.replace("BroadcastSuccess", {
        landmarkName: landmark.name,
        landmarkEmoji: landmark.emoji,
        audienceCount: count,
      });
    } catch (e: any) {
      Alert.alert("Couldn't post", e.message ?? "Try again.");
      setPosting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Text style={styles.back}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.spotEmoji}>{landmark?.emoji ?? "📍"}</Text>
          <Text style={styles.spotName}>{landmark?.name ?? "Loading…"}</Text>
          <Text style={styles.sub}>When are you headed?</Text>

          <View style={styles.chips}>
            {TIME_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.minutes}
                onPress={() => setMinutesFromNow(opt.minutes)}
                style={[styles.chip, minutesFromNow === opt.minutes && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    minutesFromNow === opt.minutes && styles.chipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sub, { marginTop: SPACING.xl }]}>
            Optional note (max 80 chars)
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. bringing scooters, come play!"
            placeholderTextColor={COLORS.textTertiary}
            value={message}
            onChangeText={setMessage}
            maxLength={80}
            multiline
          />
        </View>

        <View style={styles.footer}>
          <Button title="Broadcast" onPress={broadcast} loading={posting} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

async function estimateAudience(myFamilyId: string, landmarkId: string): Promise<number> {
  // Same shape as the edge function: friends ∩ landmark subscribers.
  const { data: friends } = await supabase
    .from("friendships")
    .select("friend_family_id")
    .eq("family_id", myFamilyId);
  const ids = (friends ?? []).map((r: any) => r.friend_family_id);
  if (ids.length === 0) return 0;
  const { data: subs } = await supabase
    .from("landmark_subs")
    .select("family_id")
    .eq("landmark_id", landmarkId)
    .in("family_id", ids);
  return (subs ?? []).length;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { padding: SPACING.md, alignItems: "flex-end" },
  back: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
  body: { flex: 1, padding: SPACING.xl, alignItems: "center" },
  spotEmoji: { fontSize: 72 },
  spotName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: "800",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
  sub: { color: COLORS.textSecondary, marginTop: SPACING.md },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "center",
    marginTop: SPACING.md,
  },
  chip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textPrimary, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  input: {
    alignSelf: "stretch",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    minHeight: 70,
    ...SHADOW.sm,
  },
  footer: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
