import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useLang, LANGUAGES } from "@/i18n";
import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/utils/theme";

// Segmented control of supported languages. Each option shows its own
// endonym ("English", "Deutsch") so a German speaker recognises it even
// while the rest of the UI is still in English.
export function LanguagePicker() {
  const { lang, setLang, t } = useLang();
  return (
    <View style={styles.row}>
      {LANGUAGES.map((l) => {
        const active = l.code === lang;
        return (
          <TouchableOpacity
            key={l.code}
            style={[styles.seg, active && styles.segActive]}
            onPress={() => setLang(l.code)}
            activeOpacity={0.85}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>
              {t(l.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  seg: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
  },
  segActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  segText: { color: COLORS.textPrimary, fontWeight: "700", fontSize: FONT_SIZE.md },
  segTextActive: { color: "#fff" },
});
