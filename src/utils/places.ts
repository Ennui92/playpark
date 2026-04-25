import * as Location from 'expo-location';
import Constants from 'expo-constants';

export interface PlaceInfo {
  name: string;
  address: string;
  googlePlaceId: string | null;
}

function getGoogleApiKey(): string | null {
  const fromExtra = (Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined)
    ?.googleMapsApiKey;
  const key = fromExtra && fromExtra !== 'YOUR_GOOGLE_MAPS_API_KEY' ? fromExtra : null;
  return key ?? null;
}

// Resolve a coordinate to a human-readable place. Tries Google Places API
// first if a key is configured (better names, e.g. "Central Park Playground"),
// falls back to the OS-native reverse geocoder (no key required, returns a
// formatted street address).
export async function resolvePlace(lat: number, lng: number): Promise<PlaceInfo> {
  const key = getGoogleApiKey();
  if (key) {
    try {
      const fromGoogle = await reverseGeocodeWithGoogle(lat, lng, key);
      if (fromGoogle) return fromGoogle;
    } catch (err) {
      console.warn('Google reverse geocode failed, falling back to OS geocoder', err);
    }
  }
  return reverseGeocodeWithOS(lat, lng);
}

async function reverseGeocodeWithGoogle(
  lat: number,
  lng: number,
  apiKey: string
): Promise<PlaceInfo | null> {
  // Prefer Places "Nearby Search" so we get a real place name (park, playground)
  // instead of just a street address.
  const placesUrl =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&radius=80&type=park&key=${apiKey}`;
  try {
    const placesRes = await fetch(placesUrl);
    const placesData = await placesRes.json();
    const top = placesData.results?.[0];
    if (top?.name) {
      return {
        name: top.name,
        address: top.vicinity ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        googlePlaceId: top.place_id ?? null,
      };
    }
  } catch (err) {
    console.warn('Places nearby search failed', err);
  }

  // Fall back to Geocoding API for a formatted street address.
  const geoUrl =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?latlng=${lat},${lng}&key=${apiKey}`;
  const geoRes = await fetch(geoUrl);
  const geoData = await geoRes.json();
  const result = geoData.results?.[0];
  if (!result) return null;
  return {
    name: result.formatted_address.split(',')[0],
    address: result.formatted_address,
    googlePlaceId: result.place_id ?? null,
  };
}

async function reverseGeocodeWithOS(lat: number, lng: number): Promise<PlaceInfo> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const first = results[0];
    if (first) {
      const street = [first.streetNumber, first.street].filter(Boolean).join(' ').trim();
      const cityArea = [first.city ?? first.subregion, first.region].filter(Boolean).join(', ');
      const address = [street, cityArea, first.country].filter(Boolean).join(', ');
      const name = first.name ?? first.street ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      return {
        name,
        address: address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        googlePlaceId: null,
      };
    }
  } catch (err) {
    console.warn('OS reverse geocode failed', err);
  }
  return {
    name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    googlePlaceId: null,
  };
}
