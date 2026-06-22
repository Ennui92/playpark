import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "@/components/Button";
import { showDialog } from "@/components/dialog";
import { Landmark, RootStackParamList } from "@/types";
import { getLandmarkById } from "@/services/landmarks";
import { createBroadcast } from "@/services/broadcasts";
import { useSession } from "@/contexts/SessionContext";
import { useT, TranslationKey } from "@/i18n";
import { collection, getCountFromServer } from "firebase/firestore";
import { db } from "@/config/firebase";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

type Nav = NativeStackNavigationProp<RootStackParamList, "BroadcastCompose">;
type Route = RouteProp<RootStackParamList, "BroadcastCompose">;

// Simple relative-time chips rather than a full picker — 1 tap = broadcast.
const TIME_OPTIONS: { labelKey: TranslationKey; minutes: number }[] = [
  { labelKey: "bc.now", minutes: 0 },
  { labelKey: "bc.in15", minutes: 15 },
  { labelKey: "bc.in30", minutes: 30 },
  { labelKey: "bc.in1h", minutes: 60 },
];

export function BroadcastComposeScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { landmarkId } = route.params;
  const { family } = useSession();
  const t = useT();

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

      // Best-effort audience count (for the success animation). The edge
      // function pings ALL friends now, so the audience is simply your
      // friends — not just those subscribed to this landmark.
      const count = await estimateAudience(family.id);

      nav.replace("BroadcastSuccess", {
        landmarkName: landmark.name,
        landmarkEmoji: landmark.emoji,
        audienceCount: count,
      });
    } catch (e: any) {
      const msg = (e?.message ?? "").toLowerCase();
      if (msg.includes("already broadcasting")) {
        showDialog(t("bc.alreadyTitle"), t("bc.alreadySub"));
      } else {
        showDialog(t("bc.couldntPost"), e?.message ?? t("common.tryAgain"));
      }
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
            <Text style={styles.back}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.spotEmoji}>{landmark?.emoji ?? "📍"}</Text>
          <Text style={styles.spotName}>{landmark?.name ?? "…"}</Text>
          <Text style={styles.sub}>{t("bc.when")}</Text>

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
                  {t(opt.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sub, { marginTop: SPACING.xl }]}>{t("bc.noteLabel")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("bc.notePlaceholder")}
            placeholderTextColor={COLORS.textTertiary}
            value={message}
            onChangeText={setMessage}
            maxLength={80}
            multiline
          />
        </View>

        <View style={styles.footer}>
          <Button title={t("bc.broadcast")} onPress={broadcast} loading={posting} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

async function estimateAudience(myFamilyId: string): Promise<number> {
  // The push fan-out pings every friend on any broadcast, so the audience is
  // just your friend count.
  const snap = await getCountFromServer(
    collection(db, "families", myFamilyId, "friends")
  );
  return snap.data().count;
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
