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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckInStackParamList } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { createPlayground } from '@/services/firebase/checkInService';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOW } from '@/utils/theme';

type Nav = NativeStackNavigationProp<CheckInStackParamList, 'AddPlayground'>;
type Route = RouteProp<CheckInStackParamList, 'AddPlayground'>;

export function AddPlaygroundScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { appUser } = useAuth();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    route.params?.lat != null && route.params?.lng != null
      ? { lat: route.params.lat, lng: route.params.lng }
      : null
  );
  const [locating, setLocating] = useState(!coords);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // If the caller didn't hand us a location, grab the device's current one.
    if (coords) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch {
        // Leave coords null — user can still save without precise location.
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  async function handleSave() {
    if (!appUser) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name needed', 'Give the playground a name so friends recognise it.');
      return;
    }
    if (!coords) {
      Alert.alert(
        'Location needed',
        'We could not get your location. Enable location access so the playground shows up for nearby parents.'
      );
      return;
    }

    setSaving(true);
    try {
      const id = await createPlayground(
        trimmed,
        coords.lat,
        coords.lng,
        appUser.uid,
        address.trim() || undefined
      );
      // Jump straight into checking in at the place they just added.
      navigation.replace('CheckInConfirm', { playgroundId: id, playgroundName: trimmed });
    } catch {
      Alert.alert('Oops', 'Could not add the playground. Please try again.');
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
        <Text style={styles.headerSubtitle}>Not listed? Add it in a few seconds.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Spielplatz Kollwitzplatz"
          placeholderTextColor={COLORS.textHint}
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="next"
        />

        <Text style={styles.label}>Address / note (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Street or neighbourhood"
          placeholderTextColor={COLORS.textHint}
          value={address}
          onChangeText={setAddress}
        />

        <Text style={styles.label}>Location</Text>
        <View style={styles.locationBox}>
          {locating ? (
            <View style={styles.locationRow}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.locationText}>Getting your current location…</Text>
            </View>
          ) : coords ? (
            <View style={styles.locationRow}>
              <Text style={styles.locationEmoji}>📍</Text>
              <Text style={styles.locationText}>
                Using your current spot ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
              </Text>
            </View>
          ) : (
            <View style={styles.locationRow}>
              <Text style={styles.locationEmoji}>⚠️</Text>
              <Text style={styles.locationText}>
                No location yet — enable location access, then reopen this screen.
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.hint}>
          We use your current location so the playground appears for other parents nearby.
        </Text>

        <TouchableOpacity
          style={[styles.saveButton, (saving || !name.trim()) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || !name.trim()}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Add & check in</Text>
          )}
        </TouchableOpacity>
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
  content: { padding: SPACING.md },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
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
  locationBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  locationEmoji: { fontSize: 20 },
  locationText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  hint: { fontSize: FONT_SIZE.xs, color: COLORS.textHint, marginTop: SPACING.xs },
  saveButton: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOW.sm,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
});
