import React from "react";
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, MapPressEvent, MarkerDragStartEndEvent } from "react-native-maps";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

// Warm cream + coral palette — matches the ermis.dev / Outside aesthetic.
// Lifted from the Static Maps URL we used previously, translated to the
// JSON style format that react-native-maps consumes.
const WARM_MAP_STYLE = [
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#fff7e8" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#deebe3" }] },
  { featureType: "poi.business", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#fff0e6" }] },
  { featureType: "road", elementType: "labels", stylers: [{ saturation: -30 }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c5d8e0" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ visibility: "simplified" }] },
];

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

  function onMarkerDragEnd(e: MarkerDragStartEndEvent) { // eslint-disable-line @typescript-eslint/no-unused-vars
    const c = e.nativeEvent.coordinate;
    onCoordChange?.(c.latitude, c.longitude);
  }

  function onMapTap(e: MapPressEvent) {
    if (!onCoordChange) return;
    const c = e.nativeEvent.coordinate;
    onCoordChange(c.latitude, c.longitude);
  }

  const editable = !!onCoordChange;

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        // customMapStyle intentionally OFF — turning it on with WARM_MAP_STYLE
        // was suppressing visible tile content even though the SDK was getting
        // 2xx auth responses. Re-introduce only after testing each rule.
        // customMapStyle={WARM_MAP_STYLE}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
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
    right: SPACING.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    alignItems: "center",
  },
  editHintText: { color: "#fff", fontWeight: "600", fontSize: FONT_SIZE.xs },
});
