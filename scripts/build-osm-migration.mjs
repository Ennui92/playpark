#!/usr/bin/env node
/**
 * Build a Supabase migration that seeds Berlin landmarks from
 * OpenStreetMap (Overpass API). Covers:
 *   - leisure=playground  (aggressive — every named one in Berlin)
 *   - leisure=park        (conservative)
 *
 * Why not community_centre? OSM tags `amenity=community_centre` on
 * churches, senior centres, rowing clubhouses, LGBTQ counselling
 * services, etc. ~15% are kid-relevant. Curate by hand instead.
 *
 * ZIP resolution: many OSM playgrounds are points-in-a-park with no
 * `addr:postcode`. We fetch Berlin's postal-code boundary relations
 * in the same Overpass call and do point-in-polygon locally to
 * assign ZIPs. Anything outside Berlin's PLZ whitelist is dropped.
 *
 * Dedup: drops rows whose name OR coordinates collide with the
 * curated seed rows in migrations 0002 + 0005 (name-match OR <150m).
 *
 * Output: ../supabase/migrations/0007_seed_landmarks_osm.sql
 *
 * Run:
 *   cd scripts
 *   node build-osm-migration.mjs
 *
 * Data © OpenStreetMap contributors, ODbL.
 */

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// One combined query so we don't get rate-limited between two calls.
// `out geom` gives both `lat`/`lon` for nodes AND `geometry` for ways/
// relations, which we need for polygon stitching.
const QUERY = `
[out:json][timeout:300];
area["name"="Berlin"]["admin_level"="4"]->.berlin;
(
  nwr["leisure"="playground"]["name"](area.berlin);
  nwr["leisure"="park"]["name"](area.berlin);
  relation["boundary"="postal_code"](area.berlin);
);
out geom;
`;

// ─── Berlin ZIP whitelist from berlinZips.ts ───────────────────────────────
const zipFile = readFileSync(
  resolve(REPO_ROOT, "src/data/berlinZips.ts"),
  "utf8"
);
const BERLIN_ZIPS = new Set(
  [...zipFile.matchAll(/zip:\s*"(\d{5})"/g)].map((m) => m[1])
);
if (BERLIN_ZIPS.size < 50) {
  throw new Error(
    `Berlin ZIP set looked tiny (${BERLIN_ZIPS.size}). Check berlinZips.ts parsing.`
  );
}
console.log(`Berlin ZIP whitelist: ${BERLIN_ZIPS.size} entries.`);

// ─── Curated landmark de-dup source (existing migrations) ──────────────────
function loadCurated() {
  const re =
    /\(\s*'([^']+)',\s*'(\d{5})',\s*'[^']+',\s*'[^']+',\s*([\d.-]+),\s*([\d.-]+)\)/g;
  const sources = [
    "supabase/migrations/0002_seed_landmarks.sql",
    "supabase/migrations/0005_seed_landmarks_expanded.sql",
  ];
  const rows = [];
  for (const p of sources) {
    const sql = readFileSync(resolve(REPO_ROOT, p), "utf8");
    for (const m of sql.matchAll(re)) {
      rows.push({
        name: m[1].trim(),
        lat: parseFloat(m[3]),
        lng: parseFloat(m[4]),
      });
    }
  }
  return rows;
}

const curated = loadCurated();
console.log(`Loaded ${curated.length} curated landmarks for dedup.`);

// ─── Geometry helpers ──────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Ray-casting point-in-polygon. Ring is [[lng,lat], ...].
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Quick bbox check to skip whole polygons fast.
function inBBox(lng, lat, bb) {
  return lng >= bb.minLng && lng <= bb.maxLng && lat >= bb.minLat && lat <= bb.maxLat;
}

// Stitch an array of way-segments (each a [[lng,lat], ...] array) into
// closed rings. OSM relations split a boundary across multiple ways that
// connect end-to-end. We greedily attach the next segment that touches
// the current end (forward or reversed).
function stitchSegments(segments) {
  const eps = 1e-6;
  const same = (a, b) => Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
  const pool = segments.map((s) => s.slice());
  const rings = [];
  while (pool.length) {
    let current = pool.shift();
    let extended = true;
    while (extended) {
      extended = false;
      const tail = current[current.length - 1];
      for (let i = 0; i < pool.length; i++) {
        const seg = pool[i];
        if (same(tail, seg[0])) {
          current = current.concat(seg.slice(1));
          pool.splice(i, 1);
          extended = true;
          break;
        }
        if (same(tail, seg[seg.length - 1])) {
          current = current.concat(seg.slice(0, -1).reverse());
          pool.splice(i, 1);
          extended = true;
          break;
        }
      }
    }
    if (current.length >= 4) rings.push(current);
  }
  return rings;
}

// Pick any representative coord for an OSM element. Handles nodes
// (lat/lon), ways with `out geom` (geometry array), and relations
// whose own coords are absent but whose members have geometry.
function extractCoord(el) {
  if (el.lat != null && el.lon != null) return [el.lat, el.lon];
  if (el.center?.lat != null) return [el.center.lat, el.center.lon];
  if (el.geometry?.[0]) return [el.geometry[0].lat, el.geometry[0].lon];
  for (const m of el.members ?? []) {
    if (m.geometry?.[0]) return [m.geometry[0].lat, m.geometry[0].lon];
  }
  return null;
}

function ringBBox(ring) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}

// ─── Categorize ────────────────────────────────────────────────────────────
// Quality filters per category. Returns null = reject.
function categorize(tags) {
  const name = tags.name?.trim() ?? "";

  if (tags.leisure === "playground") {
    // Drop unnamed generics — "Spielplatz" by itself isn't useful.
    if (/^spielplatz$/i.test(name)) return null;
    return { category: "playground", emoji: "🛝" };
  }

  if (tags.leisure === "park") {
    // OSM `leisure=park` includes a lot of small memorial squares
    // ("…platz") that aren't really parks. The big "Platz" landmarks
    // are already in the curated set.
    if (/platz$/i.test(name)) return null;
    // Naturist areas are not kid-friendly. Berlin has a few.
    if (/FKK|nudist|naturist/i.test(name)) return null;
    // Bare generic names with no proper noun.
    if (/^(pocketpark|park|grünanlage|grunanlage)$/i.test(name)) return null;
    return { category: "park", emoji: "🌳" };
  }

  return null;
}

function isCuratedDup(row) {
  const TH_M = 150;
  const lname = row.name.toLowerCase();
  for (const c of curated) {
    if (c.name.toLowerCase() === lname) return true;
    if (haversine(row.lat, row.lng, c.lat, c.lng) < TH_M) return true;
  }
  return false;
}

function sqlStr(s) {
  return s.replace(/'/g, "''");
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("Querying Overpass…");
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "outside-app-seeder/1.0 (+https://github.com/Ennui92/playpark)",
      Accept: "application/json",
    },
    body: "data=" + encodeURIComponent(QUERY),
  });
  if (!res.ok) {
    throw new Error(`Overpass returned ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  console.log(`Raw elements: ${json.elements.length}`);

  // ─── Build {zip -> [{ring, bbox}, ...]} from postal_code relations ─────
  const polysByZip = {};
  let polyCount = 0;
  for (const el of json.elements) {
    if (el.type !== "relation") continue;
    if (el.tags?.boundary !== "postal_code") continue;
    const zip = el.tags.postal_code?.trim();
    if (!zip) continue;

    // Each "outer" member is a way with .geometry = [{lat,lon},...].
    // We don't stitch multi-way rings — most Berlin PLZs are a single
    // outer ring, and stitching is brittle. Treat each outer way as
    // its own ring; point-in-polygon does OR across rings anyway.
    const outers = (el.members ?? []).filter(
      (m) => m.role === "outer" && m.type === "way" && Array.isArray(m.geometry)
    );
    if (!outers.length) continue;

    const segments = outers.map((w) => w.geometry.map((p) => [p.lon, p.lat]));
    const rings = stitchSegments(segments);
    polysByZip[zip] = polysByZip[zip] ?? [];
    for (const ring of rings) {
      polysByZip[zip].push({ ring, bbox: ringBBox(ring) });
      polyCount++;
    }
  }
  console.log(
    `Loaded ${Object.keys(polysByZip).length} Berlin PLZ polygons (${polyCount} rings).`
  );

  function resolveZipFromCoords(lat, lng) {
    for (const [zip, rings] of Object.entries(polysByZip)) {
      for (const { ring, bbox } of rings) {
        if (!inBBox(lng, lat, bbox)) continue;
        if (pointInRing(lng, lat, ring)) return zip;
      }
    }
    return null;
  }

  // ─── Walk landmark candidates ──────────────────────────────────────────
  const stats = {
    kept: { playground: 0, park: 0 },
    dropped: {
      no_name: 0,
      no_category: 0,
      no_coords: 0,
      no_zip_resolved: 0,
      bad_zip: 0,
      curated_dup: 0,
      in_set_dup: 0,
    },
    zip_source: { tag: 0, polygon: 0 },
  };

  const seen = new Set();
  const final = [];

  for (const el of json.elements) {
    if (el.type === "relation" && el.tags?.boundary === "postal_code")
      continue; // already consumed

    const tags = el.tags || {};

    const name = tags.name?.trim();
    if (!name) {
      stats.dropped.no_name++;
      continue;
    }

    const cat = categorize(tags);
    if (!cat) {
      stats.dropped.no_category++;
      continue;
    }

    const coord = extractCoord(el);
    if (!coord) {
      stats.dropped.no_coords++;
      continue;
    }
    const [lat, lng] = coord;

    // ZIP resolution: prefer addr:postcode, fall back to polygon.
    let zip = tags["addr:postcode"]?.trim();
    let zipSource = "tag";
    if (!zip || !BERLIN_ZIPS.has(zip)) {
      const resolved = resolveZipFromCoords(lat, lng);
      if (!resolved) {
        stats.dropped.no_zip_resolved++;
        continue;
      }
      zip = resolved;
      zipSource = "polygon";
    }
    if (!BERLIN_ZIPS.has(zip)) {
      stats.dropped.bad_zip++;
      continue;
    }

    const row = {
      name,
      zip,
      category: cat.category,
      emoji: cat.emoji,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    };

    if (isCuratedDup(row)) {
      stats.dropped.curated_dup++;
      continue;
    }

    // In-set dedup: same name + ZIP + rounded coords (~100m).
    const dedupKey = `${row.name.toLowerCase()}|${row.zip}|${row.lat.toFixed(
      3
    )}|${row.lng.toFixed(3)}`;
    if (seen.has(dedupKey)) {
      stats.dropped.in_set_dup++;
      continue;
    }
    seen.add(dedupKey);

    final.push(row);
    stats.kept[cat.category]++;
    stats.zip_source[zipSource]++;
  }

  console.log("\nStats:");
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\nTotal rows to seed: ${final.length}`);

  // ─── Write migration ─────────────────────────────────────────────────────
  const ts = "2026-06-07";
  const header = `-- Auto-generated by scripts/build-osm-migration.mjs on ${ts}.
-- ${final.length} Berlin landmarks pulled from OpenStreetMap (Overpass API):
--   playgrounds: ${stats.kept.playground}
--   parks: ${stats.kept.park}
-- ZIPs resolved from addr:postcode tag (${stats.zip_source.tag}) or
-- Berlin postal_code boundary polygons (${stats.zip_source.polygon}).
-- Deduped against curated rows in 0002 + 0005 (name match OR <150m radius).
-- Data © OpenStreetMap contributors, ODbL.

`;

  const body =
    "insert into public.landmarks (name, zip, category, emoji, lat, lng) values\n" +
    final
      .map((r, i) => {
        const suffix = i === final.length - 1 ? ";" : ",";
        const padName = `'${sqlStr(r.name)}',`.padEnd(50);
        return `  (${padName} '${r.zip}', '${r.category}', '${r.emoji}', ${r.lat}, ${r.lng})${suffix}`;
      })
      .join("\n");

  const outPath = resolve(
    REPO_ROOT,
    "supabase/migrations/0007_seed_landmarks_osm.sql"
  );
  writeFileSync(outPath, header + body + "\n");
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
