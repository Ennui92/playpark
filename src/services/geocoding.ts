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

// Static Maps URL with a coral pin and a warm-toned style to fit the app.
// The `style=` params lighten roads/landscape and warm the water/POIs so the
// map blends into our cream + coral palette.
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

  // Map style — warm cream landscape, soft coral POIs, muted blue water.
  // Each `style=` is a separate query param. Static Maps has a ~16k URL
  // limit so keep these tight.
  const styleParams = [
    "feature:landscape|color:0xfff7e8",
    "feature:poi.park|color:0xdeebe3",
    "feature:road|color:0xffffff",
    "feature:road.arterial|color:0xfff0e6",
    "feature:road|element:labels|saturation:-30",
    "feature:water|color:0xc5d8e0",
    "feature:transit|visibility:simplified",
  ]
    .map((s) => `&style=${encodeURIComponent(s)}`)
    .join("");

  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}` +
    `&zoom=${zoom}` +
    `&size=${width}x${height}` +
    `&scale=2` +
    `&markers=${encodeURIComponent(marker)}` +
    styleParams +
    `&key=${extra.googleMapsApiKey}`
  );
}

// ─── Places Autocomplete ────────────────────────────────────────────────
// Lets the user search "Café KuchenRausch" or "Kollwitzplatz" and pick from
// a dropdown of real Google Places results.

export interface PlacePrediction {
  placeId: string;
  primary: string;       // "Café KuchenRausch"
  secondary: string;     // "Stargarder Str. 14, 10437 Berlin, Germany"
}

// Google's "New" Places API (places.googleapis.com/v1/places:autocomplete).
// Biased to Berlin so neighborhood searches don't return a place in Spain.
export async function autocompletePlaces(
  query: string
): Promise<PlacePrediction[]> {
  if (!hasGoogleMapsKey() || query.trim().length < 2) return [];

  try {
    const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": extra.googleMapsApiKey!,
      },
      body: JSON.stringify({
        input: query,
        languageCode: "de",
        regionCode: "DE",
        // Bias to Berlin (52.52, 13.405) within a 25km radius
        locationBias: {
          circle: {
            center: { latitude: 52.52, longitude: 13.405 },
            radius: 25000.0,
          },
        },
      }),
    });
    const j = await r.json();
    const list = (j.suggestions ?? [])
      .map((s: any) => s.placePrediction)
      .filter(Boolean);
    return list.map((p: any) => ({
      placeId: p.placeId,
      primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    })) as PlacePrediction[];
  } catch {
    return [];
  }
}

export interface PlaceDetails {
  name: string;
  formatted: string;
  lat: number;
  lng: number;
}

// Fetch lat/lng + canonical name for a placeId from autocompletePlaces.
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!hasGoogleMapsKey()) return null;
  try {
    const r = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?languageCode=de`,
      {
        headers: {
          "X-Goog-Api-Key": extra.googleMapsApiKey!,
          "X-Goog-FieldMask": "displayName,formattedAddress,location",
        },
      }
    );
    const j = await r.json();
    if (!j.location) return null;
    return {
      name: j.displayName?.text ?? "",
      formatted: j.formattedAddress ?? "",
      lat: j.location.latitude,
      lng: j.location.longitude,
    };
  } catch {
    return null;
  }
}
