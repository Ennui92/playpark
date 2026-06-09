import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import { Button } from "@/components/Button";
import { showDialog } from "@/components/dialog";
import { createUserLandmark } from "@/services/landmarks";
import { useSession } from "@/contexts/SessionContext";
import { useT, TranslationKey } from "@/i18n";
import { LandmarkCategory } from "@/types";
import { reverseGeocode, GeocodeResult, hasGoogleMapsKey, PlaceDetails } from "@/services/geocoding";
import { BERLIN_ZIP_SET } from "@/data/berlinZips";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { MapPreview } from "@/components/MapPreview";
import { COLORS, FONT_SIZE, RADIUS, SHADOW, SPACING } from "@/utils/theme";

// label comes from t("cat.<key>") at render time.
const CATEGORIES: { key: LandmarkCategory; emoji: string }[] = [
  { key: "playground",       emoji: "🛝" },
  { key: "park",             emoji: "🌳" },
  { key: "square",           emoji: "🟧" },
  { key: "cafe",             emoji: "☕" },
  { key: "library",          emoji: "📚" },
  { key: "indoor_play",      emoji: "🎪" },
  { key: "community_center", emoji: "🏛️" },
  { key: "flea_market",      emoji: "🛍️" },
  { key: "event",            emoji: "🎉" },
  { key: "other",            emoji: "📍" },
];

export function AddLandmarkScreen() {
  const nav = useNavigation();
  const { family } = useSession();
  const t = useT();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<LandmarkCategory>("cafe");
  const [emoji, setEmoji] = useState("☕");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<GeocodeResult | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function useCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showDialog(t("add.permNeeded"), t("add.permSub"));
        setLocating(false);
        return;
      }
      // getCurrentPositionAsync can hang indefinitely on some devices.
      // Wrap in a race with a hard timeout + fall back to the last known
      // position (which is fast + still useful).
      const timeoutMs = 10_000;
      const loc = await Promise.race<Location.LocationObject | null>([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), timeoutMs)
        ),
      ]).catch(async () => {
        // Timeout → try last known as a fallback (usually instant).
        return Location.getLastKnownPositionAsync();
      });
      if (loc) {
        const next = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCoords(next);
        // Fire-and-forget the reverse-geocode. We don't block UI on it.
        reverseGeocode(next.lat, next.lng)
          .then((g) => setGeo(g))
          .catch(() => {});
      } else {
        showDialog(t("add.noFix"), t("add.noFixSub"));
      }
    } catch (e: any) {
      showDialog(t("add.couldntLocate"), e.message ?? t("common.tryAgain"));
    } finally {
      setLocating(false);
    }
  }

  // Don't auto-prompt on mount — some users get a dead spinner if the
  // OS permission dialog blocks without resolving. Let them tap the button.
  // (Intentionally no useEffect here.)

  function pickCategory(c: LandmarkCategory, e: string) {
    setCategory(c);
    setEmoji(e);
  }

  async function save() {
    if (!family || !name.trim() || !coords) return;
    setSaving(true);
    try {
      // Prefer the ZIP the geocoder returned, fallback to the family's.
      const detectedZip =
        geo?.zip && BERLIN_ZIP_SET.has(geo.zip) ? geo.zip : family.zip;
      const lm = await createUserLandmark({
        familyId: family.id,
        name: name.trim(),
        zip: detectedZip,
        category,
        emoji,
        lat: coords.lat,
        lng: coords.lng,
      });
      showDialog(t("add.added"), t("add.addedSub", { name: lm.name }), [
        { text: t("add.nice"), onPress: () => nav.goBack() },
      ]);
    } catch (e: any) {
      showDialog(t("add.couldntAdd"), e.message ?? t("common.tryAgain"));
    } finally {
      setSaving(false);
    }
  }

  const canSave = !!family && name.trim().length >= 1 && !!coords && !saving;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Text style={styles.back}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{t("add.title")}</Text>
          <Text style={styles.sub}>{t("add.sub")}</Text>

          {hasGoogleMapsKey() && (
            <>
              <Label>{t("add.searchLabel")}</Label>
              <PlaceAutocomplete
                placeholder={t("add.searchPlaceholder")}
                onPick={(place: PlaceDetails) => {
                  // Pre-fill everything from the picked place. Name is
                  // editable in the field below.
                  if (!name.trim()) setName(place.name);
                  setCoords({ lat: place.lat, lng: place.lng });
                  setGeo({
                    formatted: place.formatted,
                    shortName: place.name,
                    neighborhood: null,
                    zip: null,
                  });
                }}
              />
              <Text style={styles.fineprint}>{t("add.orPin")}</Text>
            </>
          )}

          <Label>{t("add.nameLabel")}</Label>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("add.namePlaceholder")}
            placeholderTextColor={COLORS.textTertiary}
            maxLength={60}
          />

          <Label>{t("add.kind")}</Label>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, category === c.key && styles.chipActive]}
                onPress={() => pickCategory(c.key, c.emoji)}
              >
                <Text style={styles.chipEmoji}>{c.emoji}</Text>
                <Text
                  style={[styles.chipLabel, category === c.key && styles.chipLabelActive]}
                >
                  {t(`cat.${c.key}` as TranslationKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Label>{t("add.location")}</Label>
          <View style={styles.locBox}>
            {coords ? (
              <>
                <Text style={styles.locAddress}>
                  📍 {geo?.shortName ?? t("add.pinned")}
                </Text>
                <Text style={styles.locFormatted}>
                  {geo?.formatted ??
                    `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
                </Text>
                {geo && (
                  <Text style={styles.locCoordsSub}>
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.locHint}>{t("add.notSet")}</Text>
            )}
            <Button
              title={
                locating
                  ? t("add.locating")
                  : coords
                    ? t("add.rePin")
                    : t("add.useLocation")
              }
              variant="secondary"
              onPress={useCurrentLocation}
              loading={locating}
              style={{ marginTop: SPACING.sm }}
            />
            <Text style={styles.locFine}>{t("add.tipStand")}</Text>
          </View>

          {coords && (
            <View style={{ marginTop: SPACING.md }}>
              <MapPreview
                lat={coords.lat}
                lng={coords.lng}
                height={220}
                showDirections={false}
                label={name || undefined}
                onCoordChange={(lat, lng) => setCoords({ lat, lng })}
              />
              <Text style={styles.locFine}>{t("add.tipDrag")}</Text>
            </View>
          )}

          <Button
            title={t("add.addPlace")}
            onPress={save}
            loading={saving}
            disabled={!canSave}
            style={{ marginTop: SPACING.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { padding: SPACING.md, alignItems: "flex-end" },
  back: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
  body: { padding: SPACING.xl, paddingBottom: SPACING.xxl },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: "800", color: COLORS.textPrimary },
  sub: { color: COLORS.textSecondary, marginTop: SPACING.xs },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipEmoji: { fontSize: 18 },
  chipLabel: { color: COLORS.textPrimary, fontWeight: "600" },
  chipLabelActive: { color: "#fff" },
  locBox: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOW.sm,
  },
  locAddress: { color: COLORS.textPrimary, fontWeight: "700", fontSize: FONT_SIZE.md },
  locFormatted: { color: COLORS.textSecondary, marginTop: 2 },
  locCoordsSub: { color: COLORS.textTertiary, fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
  locHint: { color: COLORS.textSecondary },
  fineprint: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
  },
  locFine: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.sm,
  },
});
