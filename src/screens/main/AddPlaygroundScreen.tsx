import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckInStackParamList } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { createPlayground } from '@/services/firebase/checkInService';
import { resolvePlace, PlaceInfo } from '@/utils/places';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Nav = NativeStackNavigationProp<CheckInStackParamList, 'AddPlayground'>;

interface Coords {
  lat: number;
  lng: number;
}

export function AddPlaygroundScreen() {
  const navigation = useNavigation<Nav>();
  const { appUser } = useAuth();

  const [coords, setCoords] = useState<Coords | null>(null);
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    pickUpCurrentLocation();
  }, []);

  async function pickUpCurrentLocation() {
    setLoadingLocation(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission is needed to add the playground you’re at.');
        setLoadingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const next = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setCoords(next);
      setLoadingLocation(false);

      setResolving(true);
      const info = await resolvePlace(next.lat, next.lng);
      setPlace(info);
      setName(info.name);
      setAddress(info.address);
    } catch (err) {
      console.warn('Location/place lookup failed', err);
      setLocationError('Could not get your location. Try again.');
    } finally {
      setLoadingLocation(false);
      setResolving(false);
    }
  }

  async function handleSave() {
    if (!appUser || !coords) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your playground a name.');
      return;
    }
    setSaving(true);
    try {
      const playgroundId = await createPlayground({
        name: name.trim(),
        address: address.trim(),
        lat: coords.lat,
        lng: coords.lng,
        googlePlaceId: place?.googlePlaceId ?? null,
        createdBy: appUser.uid,
      });
      navigation.replace('CheckInConfirm', {
        playgroundId,
        playgroundName: name.trim(),
      });
    } catch (err) {
      console.warn('createPlayground failed', err);
      Alert.alert('Oops', 'Could not save the playground. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add a playground</Text>
        <Text style={styles.headerSubtitle}>
          Drop a pin where you are so other parents can find it.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loadingLocation ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Finding your location…</Text>
          </View>
        ) : locationError ? (
          <View style={styles.centered}>
            <Text style={styles.errorEmoji}>📍</Text>
            <Text style={styles.errorText}>{locationError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={pickUpCurrentLocation}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={resolving ? 'Looking up the place…' : 'e.g. Riverside Playground'}
              placeholderTextColor={COLORS.textHint}
              maxLength={80}
              editable={!resolving}
            />

            <Text style={styles.sectionLabel}>Address</Text>
            <TextInput
              style={[styles.input, styles.addressInput]}
              value={address}
              onChangeText={setAddress}
              placeholder={resolving ? 'Looking up the address…' : 'Street, city'}
              placeholderTextColor={COLORS.textHint}
              multiline
              maxLength={200}
              editable={!resolving}
            />

            {coords && (
              <Text style={styles.coordsHint}>
                Pin: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </Text>
            )}

            {resolving && (
              <View style={styles.resolvingRow}>
                <ActivityIndicator color={COLORS.primary} size="small" />
                <Text style={styles.resolvingText}>Looking up place name…</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveButton, (saving || resolving) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving || resolving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save & continue</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  back: { color: COLORS.primary, fontSize: FONT_SIZE.md, marginBottom: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.textPrimary },
  headerSubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  content: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xxl },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxl, gap: SPACING.md },
  loadingText: { color: COLORS.textSecondary },
  errorEmoji: { fontSize: 48 },
  errorText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center' },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  retryButtonText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressInput: { minHeight: 64, textAlignVertical: 'top' },
  coordsHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textHint,
    marginTop: SPACING.xs,
  },
  resolvingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  resolvingText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
    ...SHADOW.md,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '700' },
});
