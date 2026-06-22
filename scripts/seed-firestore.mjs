/**
 * Seed the shared landmark catalogue into Firestore.
 *
 * Landmarks are public REFERENCE data (not user data), so we carry them over
 * from the old Supabase project. Everything else (families, broadcasts, …)
 * starts fresh.
 *
 * Emulator:  set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 then `node scripts/seed-firestore.mjs`
 * Live:      set GOOGLE_APPLICATION_CREDENTIALS=<service-account.json> then run
 */
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "outside-playpark-ermis";
const SUPABASE_URL = "https://vqwzyrydhsourpkjdmot.supabase.co";
const SUPABASE_ANON = "sb_publishable_YISeb0avhXXh6XiGs6abcA_nKt9pVTm";

const useEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

initializeApp(
  useEmulator
    ? { projectId: PROJECT_ID }
    : {
        projectId: PROJECT_ID,
        credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
          ? cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
          : applicationDefault(),
      }
);
const db = getFirestore();

async function fetchAllLandmarks() {
  const all = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/landmarks?select=id,name,zip,category,emoji,lat,lng,created_by_family_id,place_id`,
      {
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
          Range: `${from}-${to}`,
        },
      }
    );
    if (!resp.ok) throw new Error(`supabase ${resp.status}: ${await resp.text()}`);
    const rows = await resp.json();
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

async function main() {
  console.log(`Seeding landmarks into ${useEmulator ? "EMULATOR" : "LIVE"} (${PROJECT_ID})`);
  const rows = await fetchAllLandmarks();
  console.log(`Fetched ${rows.length} landmarks from Supabase`);

  let written = 0;
  for (let i = 0; i < rows.length; i += 450) {
    const batch = db.batch();
    for (const r of rows.slice(i, i + 450)) {
      batch.set(db.collection("landmarks").doc(String(r.id)), {
        name: r.name,
        zip: r.zip,
        category: r.category,
        emoji: r.emoji ?? "🛝",
        lat: r.lat,
        lng: r.lng,
        created_by_family_id: r.created_by_family_id ?? null,
        place_id: r.place_id ?? null,
        created_at: new Date().toISOString(),
      });
    }
    await batch.commit();
    written += Math.min(450, rows.length - i);
    console.log(`  …${written}/${rows.length}`);
  }
  console.log(`✅ Seeded ${written} landmarks`);
  process.exit(0);
}

main().catch((e) => {
  console.error("SEED FAILED ❌", e);
  process.exit(1);
});
