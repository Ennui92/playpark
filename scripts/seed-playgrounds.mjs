#!/usr/bin/env node
/**
 * Seed the `playgrounds` collection in Firestore.
 *
 * Works against the local Firebase Emulator (recommended for dev) or a real
 * project. The seeder is idempotent: it derives a deterministic doc ID from
 * the playground name + rounded coordinates, so re-running won't create
 * duplicates.
 *
 * ── Seed the LOCAL EMULATOR (no credentials needed) ──────────────────────────
 *   1. In one terminal:  firebase emulators:start
 *   2. In another:        npm run seed:emulator
 *
 * ── Seed a REAL project ──────────────────────────────────────────────────────
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   export FIREBASE_PROJECT_ID=your-project-id
 *   npm run seed
 *
 * ── Which data file? ─────────────────────────────────────────────────────────
 *   Defaults to berlin-playgrounds.generated.json (from fetch-berlin-playgrounds.mjs)
 *   if it exists, otherwise the bundled curated berlin-playgrounds.json.
 *   Override with:  SEED_FILE=berlin-playgrounds.json npm run seed:emulator
 */

import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, GeoPoint } from 'firebase-admin/firestore';

const useEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'playpark-dev';

function slug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (ü -> u, etc.)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function docId(p) {
  return `${slug(p.name)}-${p.lat.toFixed(3)}-${p.lng.toFixed(3)}`.slice(0, 120);
}

function resolveDataFile() {
  if (process.env.SEED_FILE) return new URL(`./${process.env.SEED_FILE}`, import.meta.url);
  const generated = new URL('./berlin-playgrounds.generated.json', import.meta.url);
  if (existsSync(generated)) return generated;
  return new URL('./berlin-playgrounds.json', import.meta.url);
}

async function main() {
  // The emulator accepts any credentials; a real project needs a service account.
  if (useEmulator) {
    initializeApp({ projectId });
    console.log(`Seeding EMULATOR at ${process.env.FIRESTORE_EMULATOR_HOST} (project: ${projectId})`);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    initializeApp({ credential: cert(sa), projectId: sa.project_id || projectId });
    console.log(`Seeding REAL project: ${sa.project_id || projectId}`);
  } else {
    console.error(
      'No FIRESTORE_EMULATOR_HOST and no GOOGLE_APPLICATION_CREDENTIALS.\n' +
        'For local dev run:  npm run seed:emulator  (with the emulator running).'
    );
    process.exit(1);
  }

  const file = resolveDataFile();
  const playgrounds = JSON.parse(readFileSync(file, 'utf8'));
  console.log(`Loaded ${playgrounds.length} playgrounds from ${file.pathname.split('/').pop()}`);

  const db = getFirestore();
  let batch = db.batch();
  let opCount = 0;
  let written = 0;

  for (const p of playgrounds) {
    const ref = db.collection('playgrounds').doc(docId(p));
    batch.set(
      ref,
      {
        name: p.name,
        address: p.address || 'Berlin',
        location: new GeoPoint(p.lat, p.lng),
        googlePlaceId: null,
        osmId: p.osmId || null,
        createdBy: null, // null = system/seeded, not user-created
        checkInCount: 0,
        totalVisits: 0,
      },
      { merge: true }
    );
    opCount++;
    written++;
    // Firestore batches cap at 500 ops
    if (opCount >= 450) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }
  if (opCount > 0) await batch.commit();

  console.log(`✅ Seeded ${written} playgrounds into the "playgrounds" collection.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
