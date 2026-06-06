import React, { useMemo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View, Linking } from "react-native";
import { staticMapUrl } from "@/services/geocoding";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

interface Props {
  lat: number;
  lng: number;
  height?: number;
  // Tap behaviour: opens Google Maps centered on the *exact* coordinate
  // (not a name search) so the pin always lands where the user expects.
  showOpenInMaps?: boolean;
  label?: string; // optional name to display in the maps app deep-link
}

export function MapPreview({ lat, lng, height = 180, showOpenInMaps = true, label }: Props) {
  const url = useMemo(
    () => staticMapUrl({ lat, lng, width: 700, height: 360 }),
    [lat, lng]
  );

  function openInMaps() {
    // Center on the exact coordinate AND drop a pin. The `query=lat,lng`
    // form makes Google Maps drop a pin on those coords (not search by
    // name), which is what the user wants when they tap the preview.
    const labelPart = label ? `(${encodeURIComponent(label)})` : "";
    const target = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}${labelPart}`;
    Linking.openURL(target).catch(() => {});
  }

  if (!url) {
    return (
      <TouchableOpacity style={styles.fallback} onPress={openInMaps}>
        <Text style={styles.fallbackEmoji}>🗺️</Text>
        <Text style={styles.fallbackText}>Open in Google Maps</Text>
        <Text style={styles.fallbackSub}>
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </Text>
        <Text style={styles.fallbackHint}>
          Enable Maps Static API in Google Cloud Console to see a preview here
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.wrap, { height }]}
      onPress={showOpenInMaps ? openInMaps : undefined}
      activeOpacity={showOpenInMaps ? 0.9 : 1}
    >
      <Image source={{ uri: url }} style={styles.img} resizeMode="cover" />
      {showOpenInMaps && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Open in Maps ›</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceAlt,
    ...SHADOW.sm,
  },
  img: { width: "100%", height: "100%", backgroundColor: COLORS.surfaceAlt },
  overlay: {
    position: "absolute",
    bottom: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  overlayText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZE.sm },
  fallback: {
    alignItems: "center",
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    ...SHADOW.sm,
  },
  fallbackEmoji: { fontSize: 32 },
  fallbackText: { fontWeight: "700", color: COLORS.accent, marginTop: SPACING.xs },
  fallbackSub: { color: COLORS.textTertiary, fontSize: FONT_SIZE.xs, marginTop: 2 },
  fallbackHint: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.sm,
    textAlign: "center",
  },
});
