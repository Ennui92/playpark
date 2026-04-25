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
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

interface Props {
  value: string | null;
  onChange: (zip: string) => void;
  placeholder?: string;
}

// Autocomplete: type a PLZ, a Kiez name, or both — dropdown filters live.
export function ZipPicker({ value, onChange, placeholder = "12051 or Neukölln…" }: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const selected = BERLIN_ZIPS.find((z) => z.zip === value) ?? null;
  const effectiveQuery = focused ? query : selected ? `${selected.zip} · ${selected.name}` : query;

  const results = useMemo<BerlinZip[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BERLIN_ZIPS.slice(0, 50);
    return BERLIN_ZIPS.filter(
      (z) => z.zip.startsWith(q) || z.name.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [query]);

  function pick(z: BerlinZip) {
    onChange(z.zip);
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
          // Delay so tap on item still registers
          setTimeout(() => setFocused(false), 150);
        }}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary}
        autoCorrect={false}
        autoCapitalize="none"
        keyboardType="default"
      />
      {focused && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(r) => r.zip}
            keyboardShouldPersistTaps="always"
            ListEmptyComponent={<Text style={styles.empty}>No matches</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => pick(item)}>
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
