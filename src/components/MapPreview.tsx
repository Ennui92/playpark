import React from "react";
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

interface Props {
  lat: number;
  lng: number;
  height?: number;
  // Show a small "Directions" affordance that fires the OS navigation
  // intent. The tile itself stays in-app and is pan/zoomable; we only
  // bounce out when the user explicitly wants directions.
  showDirections?: boolean;
  label?: string;
}

export function MapPreview({ lat, lng, height = 200, showDirections = true, label }: Props) {
  function openDirections() {
    // Navigation intent — proper deep-link that opens Google/Apple Maps
    // in directions mode. Falls back to the universal web URL if the
    // native scheme isn't installed; both land the user at the same coord.
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`,
      android: `google.navigation:q=${lat},${lng}&mode=w`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`,
    })!;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`
      ).catch(() => {});
    });
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        // Native gestures stay enabled — pan/zoom feel right at home.
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        <Marker
          coordinate={{ latitude: lat, longitude: lng }}
          title={label}
          // Coral pin to match the app palette.
          pinColor={COLORS.accent}
        />
      </MapView>

      {showDirections && (
        <TouchableOpacity
          style={styles.directionsBtn}
          onPress={openDirections}
          activeOpacity={0.85}
        >
          <Text style={styles.directionsText}>↗ Directions</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceAlt,
    ...SHADOW.sm,
  },
  directionsBtn: {
    position: "absolute",
    bottom: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  directionsText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZE.sm },
});
