import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as qLimit,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  Broadcast,
  BroadcastFeedItem,
  BroadcastReaction,
  BroadcastRsvpRow,
  RsvpStatus,
} from "@/types";
import { getMyFamilyId } from "@/services/me";

// Firestore queries must be fully satisfiable by the read rules — you can't
// query across broadcasts you're not allowed to read. So the feed queries by
// `family_id in [me, ...friends]` rather than "all active broadcasts" (RLS did
// the friend filter implicitly on Supabase). `in` supports up to 30 values; we
// cap there (rare to have more friend families — noted in MIGRATION.md).
const IN_CAP = 30;

async function audienceFamilyIds(): Promise<string[]> {
  const me = await getMyFamilyId();
  const friends = await getDocs(collection(db, "families", me, "friends"));
  const ids = [me, ...friends.docs.map((d) => d.id)];
  return ids.slice(0, IN_CAP);
}

function enrich(id: string, row: any): BroadcastFeedItem {
  return {
    id,
    family_id: row.family_id,
    landmark_id: row.landmark_id,
    planned_at: row.planned_at,
    message: row.message ?? null,
    kid_ids: row.kid_ids ?? [],
    created_at: row.created_at,
    expires_at: row.expires_at,
    ended_at: row.ended_at ?? null,
    family_name: row.family_name ?? "Unknown",
    family_avatar_url: row.family_avatar_url ?? null,
    landmark_name: row.landmark_name ?? "Unknown",
    landmark_emoji: row.landmark_emoji ?? "📍",
  };
}

export async function createBroadcast(params: {
  familyId: string;
  landmarkId: string;
  plannedAt: Date;
  message?: string | null;
  kidIds?: string[];
}): Promise<Broadcast> {
  // "One active broadcast per family" guard (was a Postgres trigger).
  const existing = await getMyActiveBroadcast(params.familyId);
  if (existing) throw new Error("You already have an active outing. End it first.");

  // Denormalize family + landmark fields onto the broadcast (no joins in
  // Firestore). The feed renders straight off these.
  const [fam, lm] = await Promise.all([
    getDoc(doc(db, "families", params.familyId)),
    getDoc(doc(db, "landmarks", params.landmarkId)),
  ]);
  const famData = fam.data() as any;
  const lmData = lm.data() as any;

  const planned = params.plannedAt;
  const expires = new Date(planned.getTime() + 2 * 60 * 60 * 1000); // planned + 2h

  const payload = {
    family_id: params.familyId,
    landmark_id: params.landmarkId,
    planned_at: planned.toISOString(),
    message: params.message ?? null,
    kid_ids: params.kidIds ?? [],
    created_at: new Date().toISOString(),
    expires_at: expires.toISOString(),
    ended_at: null as string | null,
    family_name: famData?.name ?? "Unknown",
    family_avatar_url: famData?.avatar_url ?? null,
    landmark_name: lmData?.name ?? "Unknown",
    landmark_emoji: lmData?.emoji ?? "📍",
  };
  const ref = await addDoc(collection(db, "broadcasts"), payload);
  return enrich(ref.id, payload);
}

export async function endBroadcast(id: string, finalMessage?: string | null) {
  const update: Record<string, any> = { ended_at: new Date().toISOString() };
  if (finalMessage !== undefined) update.message = finalMessage;
  await updateDoc(doc(db, "broadcasts", id), update);
}

export async function updateBroadcastMessage(id: string, message: string | null) {
  await updateDoc(doc(db, "broadcasts", id), { message });
}

// Feed = active broadcasts by self + friend families. We filter expires_at
// client-side to avoid a second inequality (Firestore allows one range field).
export async function getActiveFeed(): Promise<BroadcastFeedItem[]> {
  const audience = await audienceFamilyIds();
  if (audience.length === 0) return [];
  const snap = await getDocs(
    query(
      collection(db, "broadcasts"),
      where("family_id", "in", audience),
      where("ended_at", "==", null),
      orderBy("planned_at", "asc")
    )
  );
  const nowIso = new Date().toISOString();
  return snap.docs
    .map((d) => enrich(d.id, d.data()))
    .filter((b) => b.expires_at > nowIso);
}

// Every outing this family has broadcast — the personal "where you've been"
// timeline. Sorted newest-first client-side (a family won't have enough
// outings to warrant a server-side order, so no extra index is needed).
export async function getMyOutingHistory(
  familyId: string
): Promise<BroadcastFeedItem[]> {
  const snap = await getDocs(
    query(collection(db, "broadcasts"), where("family_id", "==", familyId))
  );
  return snap.docs
    .map((d) => enrich(d.id, d.data()))
    .sort((a, b) => new Date(b.planned_at).getTime() - new Date(a.planned_at).getTime());
}

// My single active broadcast (any landmark), or null. The "one active" guard
// is global per family, so this is how a screen knows whether I'm already out.
export async function getMyActiveBroadcast(
  familyId: string
): Promise<BroadcastFeedItem | null> {
  const snap = await getDocs(
    query(
      collection(db, "broadcasts"),
      where("family_id", "==", familyId),
      where("ended_at", "==", null),
      orderBy("created_at", "desc"),
      qLimit(5)
    )
  );
  const nowIso = new Date().toISOString();
  const live = snap.docs.map((d) => enrich(d.id, d.data())).filter((b) => b.expires_at > nowIso);
  return live[0] ?? null;
}

export async function getActiveBroadcastsForLandmark(
  landmarkId: string
): Promise<BroadcastFeedItem[]> {
  const audience = await audienceFamilyIds();
  if (audience.length === 0) return [];
  const snap = await getDocs(
    query(
      collection(db, "broadcasts"),
      where("family_id", "in", audience),
      where("landmark_id", "==", landmarkId),
      where("ended_at", "==", null),
      orderBy("planned_at", "asc")
    )
  );
  const nowIso = new Date().toISOString();
  return snap.docs.map((d) => enrich(d.id, d.data())).filter((b) => b.expires_at > nowIso);
}

// ─── RSVPs ────────────────────────────────────────────────────────────────

export async function setBroadcastRsvp(
  broadcastId: string,
  status: RsvpStatus
): Promise<void> {
  const myFamily = await getMyFamilyId();
  const fam = await getDoc(doc(db, "families", myFamily));
  const famData = fam.data() as any;
  const ref = doc(db, "broadcasts", broadcastId, "rsvps", myFamily);
  const prev = await getDoc(ref);
  await setDoc(
    ref,
    {
      broadcast_id: broadcastId,
      family_id: myFamily,
      status,
      created_at: prev.exists() ? (prev.data() as any).created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      family_name: famData?.name ?? "Someone",
      family_avatar_url: famData?.avatar_url ?? null,
    },
    { merge: true }
  );
}

export async function getRsvpsForBroadcast(
  broadcastId: string
): Promise<BroadcastRsvpRow[]> {
  const snap = await getDocs(collection(db, "broadcasts", broadcastId, "rsvps"));
  return snap.docs.map((d) => {
    const r = d.data() as any;
    return {
      broadcast_id: broadcastId,
      family_id: r.family_id,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      family_name: r.family_name ?? "Someone",
      family_avatar_url: r.family_avatar_url ?? null,
    };
  });
}

export async function getMyRsvp(
  broadcastId: string,
  myFamilyId: string
): Promise<RsvpStatus | null> {
  const snap = await getDoc(doc(db, "broadcasts", broadcastId, "rsvps", myFamilyId));
  return snap.exists() ? ((snap.data() as any).status as RsvpStatus) : null;
}

// ─── Reactions ─────────────────────────────────────────────────────────────

// The fixed palette of quick reactions. Kept small so the bar stays a single
// tap, not a picker.
export const REACTION_EMOJIS = ["👍", "❤️", "🎉", "😮", "😂"] as const;

export async function getReactionsForBroadcast(
  broadcastId: string
): Promise<BroadcastReaction[]> {
  const snap = await getDocs(collection(db, "broadcasts", broadcastId, "reactions"));
  return snap.docs.map((d) => {
    const r = d.data() as any;
    return {
      broadcast_id: broadcastId,
      family_id: r.family_id,
      emoji: r.emoji,
      family_name: r.family_name ?? "Someone",
      created_at: r.created_at,
    };
  });
}

export async function setBroadcastReaction(
  broadcastId: string,
  emoji: string
): Promise<void> {
  const myFamily = await getMyFamilyId();
  const fam = await getDoc(doc(db, "families", myFamily));
  const famData = fam.data() as any;
  await setDoc(doc(db, "broadcasts", broadcastId, "reactions", myFamily), {
    broadcast_id: broadcastId,
    family_id: myFamily,
    emoji,
    family_name: famData?.name ?? "Someone",
    created_at: new Date().toISOString(),
  });
}

export async function removeBroadcastReaction(broadcastId: string): Promise<void> {
  const myFamily = await getMyFamilyId();
  await deleteDoc(doc(db, "broadcasts", broadcastId, "reactions", myFamily));
}
