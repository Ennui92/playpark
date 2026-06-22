/**
 * Emulator-backed integration test for the Outside Firebase backend.
 *
 * Validates the Firestore data model AND the security rules end-to-end by
 * acting as two real authenticated users (A and B) against the Auth + Firestore
 * emulators — mirroring exactly what src/services/* do.
 *
 * Run:
 *   firebase emulators:exec --only auth,firestore "node scripts/test-firebase.mjs"
 * or with emulators already running:
 *   node scripts/test-firebase.mjs
 */
import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  runTransaction,
  query,
  where,
  orderBy,
  documentId,
  getCountFromServer,
} from "firebase/firestore";

const cfg = {
  apiKey: "AIzaSyBGzBR9oGVfHhTITB3Y0vJ7TYtETJwHCLU",
  authDomain: "outside-playpark-ermis.firebaseapp.com",
  projectId: "outside-playpark-ermis",
  storageBucket: "outside-playpark-ermis.firebasestorage.app",
  messagingSenderId: "212926758172",
  appId: "1:212926758172:web:1e056d0dab767ad0c1ced9",
};

const HOST = "127.0.0.1";
let passed = 0;
function ok(label) {
  passed++;
  console.log(`  ✓ ${label}`);
}
function assert(cond, label) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${label}`);
  ok(label);
}

function makeCtx(name) {
  const app = initializeApp(cfg, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, 8080);
  return { auth, db };
}

// Mirror of services/auth.completeSignup.
async function completeSignup(ctx, p) {
  const uid = ctx.auth.currentUser.uid;
  const familyRef = doc(collection(ctx.db, "families"));
  const userRef = doc(ctx.db, "users", uid);
  const unameRef = doc(ctx.db, "usernames", p.username);
  const nowIso = new Date().toISOString();
  await runTransaction(ctx.db, async (tx) => {
    const u = await tx.get(unameRef);
    if (u.exists()) throw new Error("username taken");
    tx.set(familyRef, { name: p.familyName, zip: p.zip, avatar_url: null, bio: null, created_at: nowIso });
    tx.set(userRef, { family_id: familyRef.id, display_name: p.displayName, username: p.username, push_token: null, created_at: nowIso });
    tx.set(unameRef, { uid, family_id: familyRef.id, family_name: p.familyName, display_name: p.displayName });
  });
  return familyRef.id;
}

async function main() {
  const rnd = Math.floor(Date.now() % 100000);
  const A = makeCtx("A");
  const B = makeCtx("B");

  // 1. Sign up + onboard two families.
  await createUserWithEmailAndPassword(A.auth, `a${rnd}@test.dev`, "password123");
  await createUserWithEmailAndPassword(B.auth, `b${rnd}@test.dev`, "password123");
  const famA = await completeSignup(A, { familyName: "Alpha", zip: "10115", displayName: "Ana", username: `alpha${rnd}` });
  const famB = await completeSignup(B, { familyName: "Bravo", zip: "10115", displayName: "Bo", username: `bravo${rnd}` });
  assert(famA && famB && famA !== famB, "two families created + onboarded");

  // 2. Username search index works (public read).
  const found = await getDocs(query(collection(B.db, "usernames"), where(documentId(), ">=", `alpha${rnd}`), where(documentId(), "<", `alpha${rnd}` + String.fromCharCode(0xf8ff))));
  assert(found.docs.some((d) => d.id === `alpha${rnd}`), "username prefix search finds Alpha");

  // 3. B sends a friend request to A (deterministic id from_to).
  await setDoc(doc(B.db, "friend_requests", `${famB}_${famA}`), {
    from_family_id: famB, to_family_id: famA, created_at: new Date().toISOString(),
    from_family_name: "Bravo", from_family_zip: "10115",
  });
  ok("B created friend_request B->A");

  // 4. A sees the pending request (rules: to_family_id == myFamily).
  const aReqs = await getDocs(query(collection(A.db, "friend_requests"), where("to_family_id", "==", famA), orderBy("created_at", "desc")));
  assert(aReqs.size === 1, "A sees 1 pending friend request");

  // 5. A accepts: create both friend edges (rules require the request to exist), then delete request.
  const nowIso = new Date().toISOString();
  await setDoc(doc(A.db, "families", famA, "friends", famB), { created_at: nowIso });
  await setDoc(doc(A.db, "families", famB, "friends", famA), { created_at: nowIso });
  await deleteDoc(doc(A.db, "friend_requests", `${famB}_${famA}`));
  const edge = await getDoc(doc(A.db, "families", famA, "friends", famB));
  assert(edge.exists(), "friendship edge A->B created");

  // 6. A creates a landmark + a broadcast.
  const lm = await addDoc(collection(A.db, "landmarks"), {
    name: "Volkspark", zip: "10115", category: "park", emoji: "🌳", lat: 52.53, lng: 13.4,
    created_by_family_id: famA, place_id: null, created_at: nowIso,
  });
  const planned = new Date(Date.now() + 60 * 60 * 1000);
  const bc = await addDoc(collection(A.db, "broadcasts"), {
    family_id: famA, landmark_id: lm.id, planned_at: planned.toISOString(), message: "Park time",
    kid_ids: [], created_at: nowIso, expires_at: new Date(planned.getTime() + 2 * 3600 * 1000).toISOString(),
    ended_at: null, family_name: "Alpha", family_avatar_url: null, landmark_name: "Volkspark", landmark_emoji: "🌳",
  });
  ok("A created landmark + broadcast");

  // 7. B's feed: friends-scoped query sees A's broadcast.
  const audience = [famB, famA];
  const feed = await getDocs(query(collection(B.db, "broadcasts"), where("family_id", "in", audience), where("ended_at", "==", null), orderBy("planned_at", "asc")));
  assert(feed.docs.some((d) => d.id === bc.id), "B's feed includes A's broadcast (friend-scoped read)");

  // 8. B RSVPs "coming" on A's broadcast.
  await setDoc(doc(B.db, "broadcasts", bc.id, "rsvps", famB), {
    broadcast_id: bc.id, family_id: famB, status: "coming", created_at: nowIso, updated_at: nowIso,
    family_name: "Bravo", family_avatar_url: null,
  });
  const rsvp = await getDoc(doc(A.db, "broadcasts", bc.id, "rsvps", famB));
  assert(rsvp.exists() && rsvp.data().status === "coming", "B RSVPed coming; A can read it");

  // 9. Negative test: a THIRD unrelated family cannot read A's broadcast.
  const C = makeCtx("C");
  await createUserWithEmailAndPassword(C.auth, `c${rnd}@test.dev`, "password123");
  await completeSignup(C, { familyName: "Charlie", zip: "99999", displayName: "Cy", username: `charlie${rnd}` });
  let denied = false;
  try {
    await getDoc(doc(C.db, "broadcasts", bc.id));
  } catch (e) {
    denied = e?.code === "permission-denied";
  }
  assert(denied, "non-friend CANNOT read the broadcast (rules enforced)");

  // 10. Count helper (used for badges).
  const cnt = await getCountFromServer(collection(A.db, "families", famA, "friends"));
  assert(cnt.data().count === 1, "A has 1 friend (count helper)");

  console.log(`\nALL ${passed} CHECKS PASSED ✅`);
  process.exit(0);
}

main().catch((e) => {
  console.error("\nTEST FAILED ❌\n", e);
  process.exit(1);
});
