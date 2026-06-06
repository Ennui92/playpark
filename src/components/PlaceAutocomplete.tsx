import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {
  autocompletePlaces,
  getPlaceDetails,
  PlacePrediction,
  PlaceDetails,
} from "@/services/geocoding";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

interface Props {
  onPick: (place: PlaceDetails) => void;
  placeholder?: string;
}

// Search Berlin places by name or address. Debounced 300ms.
export function PlaceAutocomplete({ onPick, placeholder }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      const r = await autocompletePlaces(q);
      setResults(r);
      setLoading(false);
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  async function pick(p: PlacePrediction) {
    setResolving(true);
    setResults([]);
    setQ(p.primary);
    const details = await getPlaceDetails(p.placeId);
    setResolving(false);
    if (details) onPick(details);
  }

  return (
    <View style={{ zIndex: 20 }}>
      <TextInput
        style={styles.input}
        value={q}
        onChangeText={setQ}
        placeholder={placeholder ?? "Search a place or address"}
        placeholderTextColor={COLORS.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {(loading || resolving) && (
        <ActivityIndicator
          color={COLORS.accent}
          style={styles.loadingIcon}
        />
      )}
      {results.length > 0 && (
        <View style={styles.dropdown}>
          {results.slice(0, 8).map((r) => (
            <TouchableOpacity
              key={r.placeId}
              style={styles.row}
              onPress={() => pick(r)}
            >
              <Text style={styles.primary} numberOfLines={1}>
                {r.primary}
              </Text>
              {!!r.secondary && (
                <Text style={styles.secondary} numberOfLines={1}>
                  {r.secondary}
                </Text>
              )}
            </TouchableOpacity>
          ))}
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
  loadingIcon: {
    position: "absolute",
    right: SPACING.md,
    top: SPACING.md,
  },
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
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  primary: { fontWeight: "700", color: COLORS.textPrimary, fontSize: FONT_SIZE.md },
  secondary: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginTop: 2 },
});
