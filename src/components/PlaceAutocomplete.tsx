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
  // Optional location to bias results toward (usually the current pin /
  // user's location). Omitted → global search.
  biasCenter?: { lat: number; lng: number } | null;
}

// Search places by name or address, anywhere. Debounced 300ms. Results are
// biased toward `biasCenter` when provided so nearby spots rank first.
export function PlaceAutocomplete({ onPick, placeholder, biasCenter }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // After a pick we set the input to the picked name, which used to trip
  // the debounced effect and re-open the dropdown with "even more
  // matches for Kollwitzplatz". Track the just-picked value so we skip
  // the next autocomplete fetch when q matches it exactly.
  const lastPicked = useRef<string | null>(null);

  // Primitive bias coords so the effect doesn't re-run on every parent render
  // (object identity would otherwise change each time).
  const biasLat = biasCenter?.lat ?? null;
  const biasLng = biasCenter?.lng ?? null;

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    // Suppress the search if q hasn't changed from the just-picked value.
    if (lastPicked.current && q === lastPicked.current) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      const bias = biasLat != null && biasLng != null ? { lat: biasLat, lng: biasLng } : undefined;
      const r = await autocompletePlaces(q, bias);
      setResults(r);
      setLoading(false);
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q, biasLat, biasLng]);

  async function pick(p: PlacePrediction) {
    setResolving(true);
    setResults([]);
    lastPicked.current = p.primary;
    setQ(p.primary);
    const details = await getPlaceDetails(p.placeId);
    setResolving(false);
    if (details) onPick(details);
  }

  function handleChange(text: string) {
    // User started editing again → release the suppression.
    if (lastPicked.current && text !== lastPicked.current) {
      lastPicked.current = null;
    }
    setQ(text);
  }

  return (
    <View style={{ zIndex: 20 }}>
      <TextInput
        style={styles.input}
        value={q}
        onChangeText={handleChange}
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
