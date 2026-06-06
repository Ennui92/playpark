#!/usr/bin/env node
/**
 * Fetch every public playground in Berlin from OpenStreetMap via the Overpass
 * API and write them to `berlin-playgrounds.generated.json` in the same shape
 * the seeder expects: { name, address, lat, lng }.
 *
 * OSM tags playgrounds as `leisure=playground`. There are ~2,500+ in Berlin.
 * Data © OpenStreetMap contributors, ODbL.
 *
 * Usage:
 *   node fetch-berlin-playgrounds.mjs
 *
 * Requires network access to overpass-api.de (Node 18+ has global fetch).
 * If your environment blocks Overpass, just seed the bundled curated set
 * (berlin-playgrounds.json) instead — see seed-playgrounds.mjs.
 */

import { writeFileSync } from 'node:fs';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Berlin's admin boundary (admin_level=4). `nwr` = nodes, ways and relations.
const QUERY = `
[out:json][timeout:120];
area["name"="Berlin"]["admin_level"="4"]->.berlin;
nwr["leisure"="playground"](area.berlin);
out center tags;
`;

function buildAddress(tags) {
  const parts = [];
  if (tags['addr:street']) {
    parts.push([tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '));
  }
  if (tags['addr:suburb']) parts.push(tags['addr:suburb']);
  else if (tags['addr:city']) parts.push(tags['addr:city']);
  return parts.join(', ') || 'Berlin';
}

async function main() {
  console.log('Querying Overpass for Berlin playgrounds…');
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(QUERY),
  });

  if (!res.ok) {
    throw new Error(`Overpass returned ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const seen = new Set();
  const playgrounds = [];

  for (const el of json.elements) {
    const tags = el.tags || {};
    // ways/relations carry coords under `center`; nodes carry lat/lon directly
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;

    const name = tags.name || tags['playground:name'] || 'Spielplatz';
    // De-dupe playgrounds that map nearly on top of each other
    const key = `${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    playgrounds.push({
      name,
      address: buildAddress(tags),
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      osmId: `${el.type}/${el.id}`,
    });
  }

  const out = new URL('./berlin-playgrounds.generated.json', import.meta.url);
  writeFileSync(out, JSON.stringify(playgrounds, null, 2) + '\n');
  console.log(`Wrote ${playgrounds.length} playgrounds → ${out.pathname}`);
  console.log('Seed them with:  npm run seed:emulator   (or)   npm run seed');
}

main().catch((err) => {
  console.error('Fetch failed:', err.message);
  console.error('Tip: seed the bundled curated set instead (berlin-playgrounds.json).');
  process.exit(1);
});
