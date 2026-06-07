import React, { useState } from "react";
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, MapPressEvent, MarkerDragStartEndEvent, MapType } from "react-native-maps";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

interface Props {
  lat: number;
  lng: number;
  height?: number;
  showDirections?: boolean;
  label?: string;
  // When provided, the marker becomes draggable and any drop OR map-tap
  // fires this callback. Use on Add/Edit screens so users can fine-tune
  // a pin Google Places dropped slightly off.
  onCoordChange?: (lat: number, lng: number) => void;
}

export function MapPreview({
  lat,
  lng,
  height = 200,
  showDirections = true,
  label,
  onCoordChange,
}: Props) {
  const [mapType, setMapType] = useState<MapType>("standard");

  function openDirections() {
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

  function onMarkerDragEnd(e: MarkerDragStartEndEvent) {
    const c = e.nativeEvent.coordinate;
    onCoordChange?.(c.latitude, c.longitude);
  }

  function onMapTap(e: MapPressEvent) {
    if (!onCoordChange) return;
    const c = e.nativeEvent.coordinate;
    onCoordChange(c.latitude, c.longitude);
  }

  const editable = !!onCoordChange;
  // "hybrid" = satellite imagery + road/place labels. Reads way better
  // than pure satellite when you're trying to recognise where you are.
  const showingSatellite = mapType !== "standard";

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        mapType={mapType}
        loadingEnabled={true}
        loadingBackgroundColor="#fff7e8"
        loadingIndicatorColor={COLORS.accent}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          // Tighter zoom — the previous 0.005 deltas felt zoomed out for
          // a single landmark. 0.002 puts the landmark and a couple
          // blocks around it on screen.
          latitudeDelta: 0.002,
          longitudeDelta: 0.002,
        }}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onPress={editable ? onMapTap : undefined}
      >
        <Marker
          coordinate={{ latitude: lat, longitude: lng }}
          title={label}
          pinColor={COLORS.accent}
          draggable={editable}
          onDragEnd={editable ? onMarkerDragEnd : undefined}
        />
      </MapView>

      {/* Map / satellite toggle — top-right corner, always visible. */}
      <TouchableOpacity
        style={styles.mapTypeBtn}
        onPress={() => setMapType(showingSatellite ? "standard" : "hybrid")}
        activeOpacity={0.85}
      >
        <Text style={styles.mapTypeText}>
          {showingSatellite ? "🗺 Map" : "🛰 Satellite"}
        </Text>
      </TouchableOpacity>

      {editable && (
        <View style={styles.editHint}>
          <Text style={styles.editHintText}>Drag the pin or tap to move it</Text>
        </View>
      )}

      {showDirections && !editable && (
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
  editHint: {
    position: "absolute",
    top: SPACING.sm,
    left: SPACING.sm,
    right: 110, // leave room for the map-type toggle on the right
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    alignItems: "center",
  },
  editHintText: { color: "#fff", fontWeight: "600", fontSize: FONT_SIZE.xs },
  mapTypeBtn: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    ...SHADOW.sm,
  },
  mapTypeText: { color: COLORS.textPrimary, fontWeight: "700", fontSize: FONT_SIZE.sm },
});
