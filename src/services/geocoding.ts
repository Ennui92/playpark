import Constants from "expo-constants";

// Google Geocoding & Static Maps. The API key is read from
// expo.extra.googleMapsApiKey in app.json. If missing, every function
// degrades to a graceful null/placeholder — no crashes.

const extra = (Constants.expoConfig?.extra ?? {}) as {
  googleMapsApiKey?: string;
};

export function hasGoogleMapsKey(): boolean {
  const k = extra.googleMapsApiKey;
  return !!k && !k.startsWith("REPLACE_");
}

export interface GeocodeResult {
  formatted: string;          // "Körnerstraße 12, 12049 Berlin"
  shortName: string;          // "Körnerstraße 12"
  neighborhood: string | null;
  zip: string | null;
}

// Reverse-geocode lat/lng → human address.
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeResult | null> {
  if (!hasGoogleMapsKey()) return null;

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?latlng=${lat},${lng}&language=de&key=${extra.googleMapsApiKey}`;

  try {
    const r = await fetch(url);
    const j = await r.json();
    if (j.status !== "OK" || !j.results?.length) return null;

    const first = j.results[0];
    const comps = (first.address_components ?? []) as Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;

    const findComp = (type: string) =>
      comps.find((c) => c.types.includes(type))?.long_name ?? null;

    const street = findComp("route");
    const number = findComp("street_number");
    const neighborhood =
      findComp("neighborhood") ||
      findComp("sublocality_level_1") ||
      findComp("sublocality");
    const zip = findComp("postal_code");

    const shortName =
      street && number ? `${street} ${number}` : street ?? first.formatted_address;

    return {
      formatted: first.formatted_address,
      shortName,
      neighborhood,
      zip,
    };
  } catch {
    return null;
  }
}

// Build a Google Static Maps image URL for a single pin.
// Returns null if no API key (caller can show a fallback card).
export function staticMapUrl(params: {
  lat: number;
  lng: number;
  width?: number;
  height?: number;
  zoom?: number;
}): string | null {
  if (!hasGoogleMapsKey()) return null;
  const { lat, lng, width = 600, height = 300, zoom = 16 } = params;
  const marker = `color:0xFF7A59|${lat},${lng}`;
  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}` +
    `&zoom=${zoom}` +
    `&size=${width}x${height}` +
    `&scale=2` +
    `&markers=${encodeURIComponent(marker)}` +
    `&key=${extra.googleMapsApiKey}`
  );
}
