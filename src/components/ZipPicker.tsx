import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Keyboard,
} from "react-native";
import { BERLIN_ZIPS, BerlinZip } from "@/data/berlinZips";
import { isLikelyPostalCode } from "@/utils/postal";
import { useT } from "@/i18n";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

interface Props {
  value: string | null;
  onChange: (zip: string) => void;
  placeholder?: string;
}

// Pick a home area by postal code. Works ANYWHERE — type any postal code
// (US, UK, anywhere) and commit it via the "Use …" row. The curated Berlin
// list stays on as quick suggestions for the app's original audience.
export function ZipPicker({ value, onChange, placeholder }: Props) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  // A selected value may be a Berlin code (show its Kiez label) or any other
  // postal code the user typed (show it as-is).
  const selectedBerlin = BERLIN_ZIPS.find((z) => z.zip === value) ?? null;
  const selectedLabel = selectedBerlin
    ? `${selectedBerlin.zip} · ${selectedBerlin.name}`
    : value ?? "";
  const effectiveQuery = focused ? query : selectedLabel || query;

  const suggestions = useMemo<BerlinZip[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BERLIN_ZIPS.slice(0, 50);
    return BERLIN_ZIPS.filter(
      (z) => z.zip.startsWith(q) || z.name.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [query]);

  // Offer "Use '<typed>'" whenever the input looks like a postal code and
  // isn't already an exact Berlin suggestion — this is what lets people
  // outside Berlin commit their own code.
  const trimmed = query.trim();
  const exactBerlin = BERLIN_ZIPS.some((z) => z.zip === trimmed);
  const showUseRow = isLikelyPostalCode(trimmed) && !exactBerlin;

  function commit(zip: string) {
    onChange(zip);
    setQuery("");
    setFocused(false);
    Keyboard.dismiss();
  }

  return (
    <View style={{ zIndex: 10 }}>
      <TextInput
        style={[styles.input, focused && styles.inputActive]}
        value={focused ? query : effectiveQuery}
        onChangeText={(t) => {
          setQuery(t);
          if (!focused) setFocused(true);
        }}
        onFocus={() => {
          setFocused(true);
          setQuery("");
        }}
        onBlur={() => {
          // Delay so a tap on a dropdown item still registers.
          setTimeout(() => setFocused(false), 150);
        }}
        placeholder={placeholder ?? t("zip.placeholder")}
        placeholderTextColor={COLORS.textTertiary}
        autoCorrect={false}
        autoCapitalize="characters"
        keyboardType="default"
        returnKeyType="done"
        onSubmitEditing={() => {
          if (showUseRow) commit(trimmed);
        }}
      />
      {focused && (
        <View style={styles.dropdown}>
          {showUseRow && (
            <TouchableOpacity style={styles.useRow} onPress={() => commit(trimmed)}>
              <Text style={styles.useText}>{t("zip.use", { code: trimmed })}</Text>
            </TouchableOpacity>
          )}
          <FlatList
            data={suggestions}
            keyExtractor={(r) => r.zip}
            keyboardShouldPersistTaps="always"
            ListEmptyComponent={
              showUseRow ? null : <Text style={styles.empty}>{t("zip.typeYours")}</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => commit(item.zip)}>
                <Text style={styles.zip}>{item.zip}</Text>
                <Text style={styles.name}>{item.name}</Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 260 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  inputActive: { borderColor: COLORS.accent },
  dropdown: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.md,
  },
  useRow: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.accentLight,
    borderTopLeftRadius: RADIUS.md,
    borderTopRightRadius: RADIUS.md,
  },
  useText: { color: COLORS.accentDark, fontWeight: "700" },
  row: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  zip: { fontWeight: "700", color: COLORS.textPrimary, width: 56 },
  name: { color: COLORS.textSecondary, flex: 1 },
  empty: { padding: SPACING.md, color: COLORS.textSecondary, textAlign: "center" },
});
