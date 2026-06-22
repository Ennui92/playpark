/**
 * Outside (playpark) — Cloud Functions.
 *
 * Replaces the old Supabase edge functions + Postgres push triggers. Each
 * Firestore trigger fans out Expo push notifications, mirroring the original
 * behaviour:
 *   - broadcast created   → notify friend families (minus muted landmarks)
 *   - broadcast updated   → notify RSVPed families on status change / wrap-up
 *   - friend request made → notify the recipient family
 *   - RSVP changed        → notify the broadcasting family
 *
 * DEPLOY NOTE: Cloud Functions require the Blaze (pay-as-you-go) plan. Until
 * billing is enabled these won't deploy; the app still works (in-app feed via
 * Firestore), it just won't send background push. See MIGRATION.md.
 */
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  sound?: "default";
}

async function sendExpoPush(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return;
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
    } catch (e) {
      console.error("[push] expo send failed", e);
    }
  }
}

// Collect Expo push tokens for every member of a family.
async function tokensForFamily(familyId: string): Promise<string[]> {
  const members = await db.collection("users").where("family_id", "==", familyId).get();
  return members.docs
    .map((d) => d.data().push_token as string | undefined)
    .filter((t): t is string => !!t && t.startsWith("ExponentPushToken"));
}

async function friendFamilyIds(familyId: string): Promise<string[]> {
  const snap = await db.collection("families").doc(familyId).collection("friends").get();
  return snap.docs.map((d) => d.id);
}

async function isMuted(familyId: string, landmarkId: string): Promise<boolean> {
  const d = await db.collection("families").doc(familyId).collection("mutes").doc(landmarkId).get();
  return d.exists;
}

export const onBroadcastCreated = onDocumentCreated("broadcasts/{id}", async (event) => {
  const b = event.data?.data();
  if (!b) return;
  const friends = await friendFamilyIds(b.family_id);
  const messages: ExpoMessage[] = [];
  for (const fid of friends) {
    if (await isMuted(fid, b.landmark_id)) continue;
    const tokens = await tokensForFamily(fid);
    for (const to of tokens) {
      messages.push({
        to,
        title: `${b.landmark_emoji ?? "📍"} ${b.family_name} → ${b.landmark_name}`,
        body: b.message ? String(b.message) : "Heading out — tap to RSVP",
        data: { type: "broadcast", landmarkId: b.landmark_id, broadcastId: event.params.id },
        channelId: "broadcasts",
        sound: "default",
      });
    }
  }
  await sendExpoPush(messages);
});

export const onBroadcastUpdated = onDocumentUpdated("broadcasts/{id}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const ended = !before.ended_at && !!after.ended_at;
  const messageChanged = before.message !== after.message;
  if (!ended && !messageChanged) return;

  // Audience: families who RSVPed coming/maybe.
  const rsvps = await db.collection("broadcasts").doc(event.params.id).collection("rsvps").get();
  const audience = rsvps.docs
    .filter((d) => ["coming", "maybe"].includes(d.data().status))
    .map((d) => d.data().family_id as string);

  const messages: ExpoMessage[] = [];
  for (const fid of audience) {
    const tokens = await tokensForFamily(fid);
    for (const to of tokens) {
      messages.push({
        to,
        title: ended ? `${after.family_name} wrapped up` : `${after.family_name} — update`,
        body: ended
          ? `${after.landmark_name} outing ended`
          : after.message
          ? String(after.message)
          : "Plan updated",
        data: { type: "broadcast", landmarkId: after.landmark_id, broadcastId: event.params.id },
        channelId: "broadcasts",
        sound: "default",
      });
    }
  }
  await sendExpoPush(messages);
});

export const onFriendRequestCreated = onDocumentCreated("friend_requests/{id}", async (event) => {
  const r = event.data?.data();
  if (!r) return;
  const tokens = await tokensForFamily(r.to_family_id);
  const messages = tokens.map((to) => ({
    to,
    title: "New friend request",
    body: `${r.from_family_name ?? "A family"} wants to follow your outings`,
    data: { type: "friend_request" },
    channelId: "friend_requests",
    sound: "default" as const,
  }));
  await sendExpoPush(messages);
});

export const onRsvpChanged = onDocumentWritten("broadcasts/{bid}/rsvps/{fid}", async (event) => {
  const after = event.data?.after.data();
  if (!after) return; // deletion — ignore
  const before = event.data?.before.data();
  if (before && before.status === after.status) return; // no status change

  const bSnap = await db.collection("broadcasts").doc(event.params.bid).get();
  const b = bSnap.data();
  if (!b) return;

  const tokens = await tokensForFamily(b.family_id);
  const verb =
    after.status === "coming" ? "is coming" : after.status === "maybe" ? "might come" : "can't make it";
  const messages = tokens.map((to) => ({
    to,
    title: "Outing RSVP",
    body: `${after.family_name ?? "A friend"} ${verb} to ${b.landmark_name}`,
    data: { type: "rsvp", landmarkId: b.landmark_id, broadcastId: event.params.bid },
    channelId: "rsvps",
    sound: "default" as const,
  }));
  await sendExpoPush(messages);
});
