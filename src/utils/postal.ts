// Lenient, worldwide postal-code check. Postal codes vary wildly by
// country — US "94103", UK "SW1A 1AA", Canada "K1A 0B1", Germany "12051",
// Ireland "D02 AF30" — so we don't validate per-country. We just require
// something that looks like a postal code: 2–10 chars, letters/digits with
// optional spaces or hyphens, starting alphanumeric. This replaced the old
// Berlin-only allowlist so the app works anywhere.
export function isLikelyPostalCode(s: string): boolean {
  const v = s.trim();
  return /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/.test(v);
}

// Normalise for storage/compare: trim, collapse inner whitespace, uppercase
// (postal codes are case-insensitive; UK/CA codes are conventionally upper).
export function normalizePostalCode(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}
