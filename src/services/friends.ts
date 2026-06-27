import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as qLimit,
  getCountFromServer,
  documentId,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { Family, FriendFamily, FriendRequest } from "@/types";
import { getMyFamilyId } from "@/services/me";

// Ξ²β€β‚¬Ξ²β€β‚¬ Friend graph Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬
// Supabase did all of this in SECURITY DEFINER RPCs (privileged server writes).
// On Firestore the same operations run client-side, gated by security rules:
//  - friendships are stored as bidirectional edge docs:
//      families/{a}/friends/{b}  and  families/{b}/friends/{a}
//  - friend_requests use a deterministic id `${from}_${to}` so rules and the
//    mutual-interest fast path can look them up by existence.
// See firestore.rules + MIGRATION.md for the security model.

function reqId(from: string, to: string) {
  return `${from}_${to}`;
}

async function myFamilyDoc() {
  const fid = await getMyFamilyId();
  const snap = await getDoc(doc(db, "families", fid));
  return { id: fid, data: snap.data() as any };
}

async function areFriends(a: string, b: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "families", a, "friends", b));
  return snap.exists();
}

// Create both edges of a friendship (idempotent).
async function linkFriends(a: string, b: string) {
  const nowIso = new Date().toISOString();
  await Promise.all([
    setDoc(doc(db, "families", a, "friends", b), { created_at: nowIso }),
    setDoc(doc(db, "families", b, "friends", a), { created_at: nowIso }),
  ]);
}

// Either send a pending request, OR Ξ²β‚¬β€ if the target already requested us Ξ²β‚¬β€
// auto-accept (mutual-interest fast path). Returns the target family id.
async function requestOrAccept(targetFamily: string): Promise<string> {
  const myFamily = await getMyFamilyId();
  if (targetFamily === myFamily) throw new Error("cannot friend self");
  if (await areFriends(myFamily, targetFamily)) return targetFamily;

  // Mutual fast path: did they already request us?
  const backRef = doc(db, "friend_requests", reqId(targetFamily, myFamily));
  const back = await getDoc(backRef);
  if (back.exists()) {
    await linkFriends(myFamily, targetFamily);
    await deleteDoc(backRef);
    return targetFamily;
  }

  // Standard path: write (or refresh) a pending request, denormalizing our
  // family name + zip so the recipient's list can render without a join.
  const me = await myFamilyDoc();
  await setDoc(doc(db, "friend_requests", reqId(myFamily, targetFamily)), {
    from_family_id: myFamily,
    to_family_id: targetFamily,
    created_at: new Date().toISOString(),
    from_family_name: me.data?.name ?? "Someone",
    from_family_zip: me.data?.zip ?? "Ξ²β‚¬β€",
  });
  return targetFamily;
}

export async function generateQrNonce(): Promise<string> {
  const me = await myFamilyDoc();
  // Firestore auto-ids come from a strong RNG Ξ²β‚¬β€ reuse one as the nonce token.
  const ref = doc(collection(db, "qr_nonces"));
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await setDoc(ref, {
    family_id: me.id,
    family_name: me.data?.name ?? "Someone",
    expires_at: expires,
    used_at: null,
    created_at: new Date().toISOString(),
  });
  return ref.id;
}

export async function addFriendViaQr(nonce: string): Promise<string> {
  const snap = await getDoc(doc(db, "qr_nonces", nonce));
  if (!snap.exists()) throw new Error("invalid or expired nonce");
  const d = snap.data() as any;
  if (d.used_at) throw new Error("invalid or expired nonce");
  if (d.expires_at <= new Date().toISOString()) throw new Error("invalid or expired nonce");
  const target = await requestOrAccept(d.family_id);
  // Best-effort: mark the nonce used.
  await setDoc(doc(db, "qr_nonces", nonce), { used_at: new Date().toISOString() }, { merge: true }).catch(
    () => {}
  );
  return target;
}

export async function addFriendViaUsername(username: string): Promise<string> {
  const snap = await getDoc(doc(db, "usernames", username.trim().toLowerCase()));
  if (!snap.exists()) throw new Error("user not found");
  return requestOrAccept((snap.data() as any).family_id);
}

export async function removeFriendship(otherFamilyId: string): Promise<void> {
  const myFamily = await getMyFamilyId();
  await Promise.all([
    deleteDoc(doc(db, "families", myFamily, "friends", otherFamilyId)),
    deleteDoc(doc(db, "families", otherFamilyId, "friends", myFamily)),
  ]);
}

export async function getFriendFamilies(myFamilyId: string): Promise<FriendFamily[]> {
  const edges = await getDocs(collection(db, "families", myFamilyId, "friends"));
  const fams = await Promise.all(
    edges.docs.map(async (e) => {
      const f = await getDoc(doc(db, "families", e.id));
      if (!f.exists()) return null;
      const note = ((e.data() as any).note ?? null) as string | null;
      return { id: f.id, ...(f.data() as Omit<Family, "id">), note } as FriendFamily;
    })
  );
  return fams.filter((f): f is FriendFamily => f !== null);
}

// My private note about a friend, stored on my side of the edge
// (families/{me}/friends/{them}). Only I can read or write it.
export async function getFriendNote(friendFamilyId: string): Promise<string | null> {
  const myFamily = await getMyFamilyId();
  const snap = await getDoc(doc(db, "families", myFamily, "friends", friendFamilyId));
  return snap.exists() ? (((snap.data() as any).note ?? null) as string | null) : null;
}

export async function setFriendNote(friendFamilyId: string, note: string): Promise<void> {
  const myFamily = await getMyFamilyId();
  await setDoc(
    doc(db, "families", myFamily, "friends", friendFamilyId),
    { note: note.trim() },
    { merge: true }
  );
}

export async function searchUsername(prefix: string) {
  const p = prefix.toLowerCase();
  // Prefix range query on the username (the usernames doc id).
  const snap = await getDocs(
    query(
      collection(db, "usernames"),
      where(documentId(), ">=", p),
      where(documentId(), "<", p + String.fromCharCode(0xf8ff)),
      qLimit(10)
    )
  );
  return snap.docs.map((d) => ({
    family_id: (d.data() as any).family_id as string,
    family_name: (d.data() as any).family_name as string,
    username: d.id,
  }));
}

// Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬ Friend requests Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬Ξ²β€β‚¬

export async function getPendingFriendRequests(): Promise<FriendRequest[]> {
  const myFamily = await getMyFamilyId();
  const snap = await getDocs(
    query(
      collection(db, "friend_requests"),
      where("to_family_id", "==", myFamily),
      orderBy("created_at", "desc")
    )
  );
  return snap.docs.map((d) => {
    const r = d.data() as any;
    return {
      id: d.id,
      from_family_id: r.from_family_id,
      to_family_id: r.to_family_id,
      created_at: r.created_at,
      from_family_name: r.from_family_name ?? "Someone",
      from_family_zip: r.from_family_zip ?? "Ξ²β‚¬β€",
    };
  });
}

export async function getPendingRequestCount(myFamilyId: string): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, "friend_requests"), where("to_family_id", "==", myFamilyId))
  );
  return snap.data().count;
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const myFamily = await getMyFamilyId();
  const reqRef = doc(db, "friend_requests", requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) throw new Error("request not found");
  const r = snap.data() as any;
  if (r.to_family_id !== myFamily) throw new Error("not your request");
  await linkFriends(myFamily, r.from_family_id);
  await deleteDoc(reqRef);
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, "friend_requests", requestId));
}
