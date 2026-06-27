import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@/components/Button";
import { showDialog } from "@/components/dialog";
import { submitFeedback, FeedbackCategory } from "@/services/feedback";
import { useT, TranslationKey } from "@/i18n";
import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/utils/theme";

const CATEGORIES: { key: FeedbackCategory; labelKey: TranslationKey; emoji: string }[] = [
  { key: "idea", labelKey: "fb.catIdea", emoji: "💡" },
  { key: "problem", labelKey: "fb.catProblem", emoji: "🐞" },
  { key: "love", labelKey: "fb.catLove", emoji: "❤️" },
  { key: "other", labelKey: "fb.catOther", emoji: "💬" },
];

export function FeedbackScreen() {
  const nav = useNavigation();
  const t = useT();
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const canSend = message.trim().length >= 2 && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      await submitFeedback(message, category);
      showDialog(t("fb.sent"), t("fb.sentSub"), [
        { text: t("common.done"), onPress: () => nav.goBack() },
      ]);
    } catch (e: any) {
      setSending(false);
      showDialog(t("fb.couldntSend"), e?.message ?? t("common.tryAgain"));
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Text style={styles.cancel}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t("fb.title")}</Text>
          <Text style={styles.sub}>{t("fb.sub")}</Text>

          <View style={styles.chips}>
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategory(c.key)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {c.emoji} {t(c.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            placeholder={t("fb.placeholder")}
            placeholderTextColor={COLORS.textTertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            textAlignVertical="top"
            maxLength={1000}
          />

          <Button
            title={t("fb.send")}
            onPress={send}
            loading={sending}
            disabled={!canSend}
            style={{ marginTop: SPACING.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { padding: SPACING.md, alignItems: "flex-end" },
  cancel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
  body: { padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "800", color: COLORS.textPrimary },
  sub: { color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 21 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  chip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textPrimary, fontWeight: "700", fontSize: FONT_SIZE.sm },
  chipTextActive: { color: "#fff" },
  input: {
    marginTop: SPACING.lg,
    minHeight: 140,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
  },
});
