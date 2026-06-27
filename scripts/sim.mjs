// Drive a synthetic "User B" against LIVE Firebase to test the social loop with
// one real device (User A = the phone). Uses admin to read A + pick a landmark,
// and the web SDK signed in as B so B's writes go through the real security rules
// (exactly like the app). Also fires the Expo pushes the Cloud Functions will.
//
// Usage (run from playpark/, GOOGLE_APPLICATION_CREDENTIALS set):
//   node scripts/sim.mjs request          B sends A a friend request (+push)
//   node scripts/sim.mjs broadcast        B starts an outing A can RSVP to (+push)
//   node scripts/sim.mjs rsvpcheck <bid>  show who RSVPed to B's outing
//   node scripts/sim.mjs end <bid>        B ends the outing (+push)
//   node scripts/sim.mjs status           print A + B ids
import { initializeApp as adminInit, applicationDefault } from "firebase-admin/app";
import { getFirestore as adminFs } from "firebase-admin/firestore";
import { initializeApp as webInit } from "firebase/app";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore, doc, collection, setDoc, getDoc, getDocs, addDoc,
  runTransaction, query, where, limit, orderBy,
} from "firebase/firestore";

const cmd = process.argv[2] || "status";

adminInit({ projectId: "outside-playpark-ermis", credential: applicationDefault() });
const adb = adminFs();

const cfg = {
  apiKey: "AIzaSyBGzBR9oGVfHhTITB3Y0vJ7TYtETJwHCLU",
  authDomain: "outside-playpark-ermis.firebaseapp.com",
  projectId: "outside-playpark-ermis",
  storageBucket: "outside-playpark-ermis.firebasestorage.app",
  messagingSenderId: "212926758172",
  appId: "1:212926758172:web:1e056d0dab767ad0c1ced9",
};
const wapp = webInit(cfg);
const wauth = getAuth(wapp);
const wdb = getFirestore(wapp);

const B = { email: "bob.tester.outside@gmail.com", pw: "testpass1234", fam: "The Testers", name: "Bob", uname: "tester_bob" };

// The real phone user = the one with a push token (fallback: first user).
async function readA() {
  const us = await adb.collection("users").get();
  let a = null;
  us.forEach((d) => { const x = d.data(); if (x.push_token) a = { uid: d.id, ...x }; });
  if (!a) us.forEach((d) => { if (!a) a = { uid: d.id, ...d.data() }; });
  if (!a) throw new Error("No User A found - sign in on the phone first.");
  const fam = await adb.collection("families").doc(a.family_id).get();
  return { uid: a.uid, familyId: a.family_id, name: fam.data()?.name ?? "?", zip: fam.data()?.zip ?? "10115", token: a.push_token };
}

async function ensureB(zip) {
  try { await createUserWithEmailAndPassword(wauth, B.email, B.pw); }
  catch (e) { if (e.code !== "auth/email-already-in-use") throw e; await signInWithEmailAndPassword(wauth, B.email, B.pw); }
  if (!wauth.currentUser) await signInWithEmailAndPassword(wauth, B.email, B.pw);
  const uid = wauth.currentUser.uid;
  const existing = await getDoc(doc(wdb, "users", uid));
  if (existing.exists()) return { uid, familyId: existing.data().family_id };
  const familyRef = doc(collection(wdb, "families"));
  const now = new Date().toISOString();
  await runTransaction(wdb, async (tx) => {
    tx.set(familyRef, { name: B.fam, zip, avatar_url: null, bio: null, created_at: now });
    tx.set(doc(wdb, "users", uid), { family_id: familyRef.id, display_name: B.name, username: B.uname, push_token: null, created_at: now });
    tx.set(doc(wdb, "usernames", B.uname), { uid, family_id: familyRef.id, family_name: B.fam, display_name: B.name });
  });
  return { uid, familyId: familyRef.id };
}

async function push(token, title, body, data) {
  if (!token) { console.log("(A has no push token - skipping notification)"); return; }
  console.log("  token:", token);
  const channel = data?.type === "friend_request" ? "friend_requests" : data?.type === "rsvp" ? "rsvps" : "broadcasts";
  const r = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify([{ to: token, title, body, sound: "default", channelId: channel, data, priority: "high" }]),
  });
  const ticket = (await r.json()).data?.[0];
  console.log("  send ->", r.status, ticket?.status, ticket?.id ?? "", ticket?.details ? JSON.stringify(ticket.details) : "");
  if (ticket?.status === "error") { console.log("  SEND ERROR:", ticket.message); return; }
  if (ticket?.id) {
    await new Promise((s) => setTimeout(s, 4000));
    const rr = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [ticket.id] }),
    });
    const rec = (await rr.json()).data?.[ticket.id];
    console.log("  receipt ->", rec?.status, rec?.message ?? "", rec?.details ? JSON.stringify(rec.details) : "");
  }
}

async function main() {
  const a = await readA();
  console.log(`User A: ${a.name} (family ${a.familyId}, zip ${a.zip})`);

  if (cmd === "status") { const b = await ensureB(a.zip); console.log(`User B: ${B.fam} (family ${b.familyId})`); return; }

  if (cmd === "request") {
    const b = await ensureB(a.zip);
    await setDoc(doc(wdb, "friend_requests", `${b.familyId}_${a.familyId}`), {
      from_family_id: b.familyId, to_family_id: a.familyId, created_at: new Date().toISOString(),
      from_family_name: B.fam, from_family_zip: a.zip,
    });
    console.log(`B (${B.fam}) sent a friend request to A.`);
    await push(a.token, "New friend request", `${B.fam} wants to follow your outings`, { type: "friend_request" });
    return;
  }

  if (cmd === "broadcast") {
    const b = await ensureB(a.zip);
    // pick a landmark in A's zip, else any landmark
    let lm = (await getDocs(query(collection(wdb, "landmarks"), where("zip", "==", a.zip), limit(1)))).docs[0];
    if (!lm) lm = (await getDocs(query(collection(wdb, "landmarks"), limit(1)))).docs[0];
    const L = lm.data();
    const planned = new Date(Date.now() + 30 * 60 * 1000);
    const ref = await addDoc(collection(wdb, "broadcasts"), {
      family_id: b.familyId, landmark_id: lm.id, planned_at: planned.toISOString(), message: "Anyone around? Heading out!",
      kid_ids: [], created_at: new Date().toISOString(), expires_at: new Date(planned.getTime() + 2 * 3600 * 1000).toISOString(),
      ended_at: null, family_name: B.fam, family_avatar_url: null, landmark_name: L.name, landmark_emoji: L.emoji ?? "📍",
    });
    console.log(`B is now broadcasting to "${L.name}". broadcast id: ${ref.id}`);
    await push(a.token, `${L.emoji ?? "📍"} ${B.fam} -> ${L.name}`, "Heading out, tap to RSVP", { type: "broadcast", landmarkId: lm.id, broadcastId: ref.id });
    return;
  }

  if (cmd === "rsvpcheck") {
    const bid = process.argv[3]; if (!bid) throw new Error("need broadcast id");
    // Read with admin (verification view; bypasses rules). In the real app B
    // reads these as the broadcaster.
    const snap = await adb.collection("broadcasts").doc(bid).collection("rsvps").get();
    console.log(`RSVPs on B's outing (${snap.size}):`);
    snap.forEach((d) => console.log(`  ${d.data().family_name}: ${d.data().status}`));
    return;
  }

  if (cmd === "end") {
    const bid = process.argv[3]; if (!bid) throw new Error("need broadcast id");
    await signInWithEmailAndPassword(wauth, B.email, B.pw).catch(() => {});
    await setDoc(doc(wdb, "broadcasts", bid), { ended_at: new Date().toISOString() }, { merge: true });
    console.log("B ended the outing.");
    await push(a.token, `${B.fam} wrapped up`, "The outing ended", { type: "broadcast" });
    return;
  }

  if (cmd === "fbtest") {
    const b = await ensureB(a.zip);
    try {
      const ref = await addDoc(collection(wdb, "feedback"), {
        family_id: b.familyId, message: "sim smoke-test feedback", category: "idea",
        app_version: "test", platform: "node", created_at: new Date().toISOString(),
      });
      console.log("valid feedback write OK:", ref.id);
    } catch (e) { console.log("VALID WRITE FAILED (rule too tight):", e.code, e.message); }
    try {
      await addDoc(collection(wdb, "feedback"), {
        family_id: "not-my-family", message: "x", category: "idea", created_at: new Date().toISOString(),
      });
      console.log("WARNING: wrong-family write ALLOWED (rule too loose)");
    } catch (e) { console.log("wrong-family write correctly rejected:", e.code); }
    // cleanup the test docs via admin
    const junk = await adb.collection("feedback").where("platform", "==", "node").get();
    for (const d of junk.docs) await d.ref.delete();
    console.log("cleaned", junk.size, "test feedback doc(s)");
    return;
  }

  if (cmd === "feedq") {
    // Run the EXACT getActiveFeed query through the real rules + index, signed
    // in as B (whose audience = B + B's friends, i.e. includes A).
    const b = await ensureB(a.zip);
    const bfriends = await getDocs(collection(wdb, "families", b.familyId, "friends"));
    const audience = [b.familyId, ...bfriends.docs.map((d) => d.id)].slice(0, 30);
    console.log("B audience (in-filter):", audience);
    try {
      const snap = await getDocs(
        query(
          collection(wdb, "broadcasts"),
          where("family_id", "in", audience),
          where("ended_at", "==", null),
          orderBy("planned_at", "asc")
        )
      );
      const nowIso = new Date().toISOString();
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => x.expires_at > nowIso);
      console.log(`feed query OK: ${snap.size} docs, ${items.length} active`);
      items.forEach((x) => console.log(`  ${x.id} fam=${x.family_name} lm=${x.landmark_name}`));
    } catch (e) {
      console.log("FEED QUERY ERROR:", e.code, "-", e.message);
    }
    return;
  }

  if (cmd === "diag") {
    const b = await ensureB(a.zip);
    const nowIso = new Date().toISOString();
    console.log("now:", nowIso);
    console.log("A family:", a.familyId, "zip", a.zip, "| B family:", b.familyId);
    const aF = await adb.collection("families").doc(a.familyId).collection("friends").get();
    const bF = await adb.collection("families").doc(b.familyId).collection("friends").get();
    console.log("A's friend edges:", aF.docs.map((d) => d.id));
    console.log("B's friend edges:", bF.docs.map((d) => d.id));
    console.log("A sees B as friend?", aF.docs.some((d) => d.id === b.familyId));
    const bcs = await adb.collection("broadcasts").where("family_id", "==", b.familyId).get();
    console.log(`B's broadcasts (${bcs.size}):`);
    bcs.forEach((d) => {
      const x = d.data();
      const active = !x.ended_at && x.expires_at > nowIso;
      console.log(`  ${d.id} active=${active} ended=${x.ended_at} planned=${x.planned_at} expires=${x.expires_at} lm=${x.landmark_name}`);
    });
    return;
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("SIM ERROR:", e); process.exit(1); });
