// Send a test Expo push to every Outside user that has a stored push token.
// Validates the push path end-to-end without needing Cloud Functions / Blaze.
// Run: GOOGLE_APPLICATION_CREDENTIALS=<sa.json> node scripts/send-test-push.mjs
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ projectId: "outside-playpark-ermis", credential: applicationDefault() });
const db = getFirestore();

const snap = await db.collection("users").get();
const tokens = [];
snap.forEach((d) => {
  const t = d.data().push_token;
  if (t) tokens.push({ uid: d.id, token: t, name: d.data().display_name });
});
console.log(`users=${snap.size} withToken=${tokens.length}`);
tokens.forEach((x) => console.log(`  ${x.name ?? "?"} (${x.uid}): ${x.token}`));

const valid = tokens.filter((x) => String(x.token).startsWith("ExponentPushToken"));
if (!valid.length) {
  console.log("No Expo push tokens stored yet (permission not granted, or token not saved).");
  process.exit(0);
}

const messages = valid.map((x) => ({
  to: x.token,
  title: "Outside is live on Firebase",
  body: `Hi ${x.name ?? "there"} - push notifications work. Tap to open.`,
  sound: "default",
  channelId: "broadcasts",
  data: { type: "test" },
}));

const resp = await fetch("https://exp.host/--/api/v2/push/send", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify(messages),
});
console.log("Expo push status:", resp.status);
console.log(await resp.text());
process.exit(0);
