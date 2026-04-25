import React, { useEffect, useRef, useState } from 'react';
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
  Platform,
} from 'react-native';
import MapView, { Marker, MapPressEvent, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { CheckInStackParamList } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getPlayground, updatePlayground } from '@/services/firebase/checkInService';
import { resolvePlace } from '@/utils/places';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Route = RouteProp<CheckInStackParamList, 'EditPlayground'>;

export function EditPlaygroundScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { playgroundId } = route.params;
  const { appUser } = useAuth();
  const mapRef = useRef<MapView | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [canEdit, setCanEdit] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const playground = await getPlayground(playgroundId);
        if (cancelled) return;
        if (!playground) {
          setError('Playground not found.');
          return;
        }
        if (appUser && playground.createdBy && playground.createdBy !== appUser.uid) {
          setCanEdit(false);
        }
        setName(playground.name);
        setAddress(playground.address);
        setPin({
          lat: playground.location.latitude,
          lng: playground.location.longitude,
        });
        setGooglePlaceId(playground.googlePlaceId ?? null);
      } catch (err) {
        console.warn('getPlayground failed', err);
        if (!cancelled) setError('Could not load this playground.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playgroundId, appUser]);

  function handleMapPress(e: MapPressEvent) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPin({ lat: latitude, lng: longitude });
    setGooglePlaceId(null); // dragging breaks the Place link; address re-resolves on demand
  }

  async function handleUseMyLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access to use your current spot.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const next = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setPin(next);
      setGooglePlaceId(null);
      mapRef.current?.animateToRegion(toRegion(next), 400);
    } catch (err) {
      console.warn('getCurrentPosition failed', err);
      Alert.alert('Oops', 'Could not get your location.');
    }
  }

  async function handleResolveAddress() {
    if (!pin) return;
    setResolvingAddress(true);
    try {
      const info = await resolvePlace(pin.lat, pin.lng);
      setAddress(info.address);
      if (info.googlePlaceId) setGooglePlaceId(info.googlePlaceId);
      if (!name.trim()) setName(info.name);
    } catch (err) {
      console.warn('resolvePlace failed', err);
    } finally {
      setResolvingAddress(false);
    }
  }

  async function handleSave() {
    if (!pin) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Give the playground a name.');
      return;
    }
    setSaving(true);
    try {
      await updatePlayground(playgroundId, {
        name: name.trim(),
        address: address.trim(),
        lat: pin.lat,
        lng: pin.lng,
        googlePlaceId,
      });
      navigation.goBack();
    } catch (err) {
      console.warn('updatePlayground failed', err);
      Alert.alert(
        'Could not save',
        'Only the parent who added this playground can edit it.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading playground…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !pin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit playground</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Could not load.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit playground</Text>
        <Text style={styles.headerSubtitle}>Drag the pin or tap the map to correct it.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!canEdit && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Only the parent who added this playground can save changes.
            </Text>
          </View>
        )}

        <View style={styles.mapBox}>
          <MapView
            ref={(r) => {
              mapRef.current = r;
            }}
            style={styles.map}
            initialRegion={toRegion(pin)}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton={Platform.OS === 'android'}
          >
            <Marker
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setPin({ lat: latitude, lng: longitude });
                setGooglePlaceId(null);
              }}
            />
          </MapView>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={styles.smallButton} onPress={handleUseMyLocation}>
            <Text style={styles.smallButtonText}>📍 Use my location</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallButton, styles.smallButtonGhost]}
            onPress={handleResolveAddress}
            disabled={resolvingAddress}
          >
            {resolvingAddress ? (
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : (
              <Text style={styles.smallButtonGhostText}>↻ Refresh address</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.coordsHint}>
          Pin: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
        </Text>

        <Text style={styles.sectionLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Playground name"
          placeholderTextColor={COLORS.textHint}
          maxLength={80}
          editable={canEdit}
        />

        <Text style={styles.sectionLabel}>Address</Text>
        <TextInput
          style={[styles.input, styles.addressInput]}
          value={address}
          onChangeText={setAddress}
          placeholder="Street, city"
          placeholderTextColor={COLORS.textHint}
          multiline
          maxLength={200}
          editable={canEdit}
        />

        <TouchableOpacity
          style={[styles.saveButton, (!canEdit || saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canEdit || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function toRegion(p: { lat: number; lng: number }): Region {
  return {
    latitude: p.lat,
    longitude: p.lng,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  };
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.md },
  loadingText: { color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center' },
  warningBox: {
    backgroundColor: COLORS.accentLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  warningText: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  mapBox: {
    height: 300,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  map: { flex: 1 },
  row: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  smallButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  smallButtonText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },
  smallButtonGhost: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  smallButtonGhostText: { color: COLORS.primary, fontWeight: '700', fontSize: FONT_SIZE.sm },
  coordsHint: { fontSize: FONT_SIZE.xs, color: COLORS.textHint, marginTop: SPACING.xs },
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
