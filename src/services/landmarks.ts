import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { Landmark } from "@/types";

function landmarkFromDoc(id: string, data: any): Landmark {
  return {
    id,
    name: data.name,
    zip: data.zip,
    category: data.category,
    emoji: data.emoji,
    lat: data.lat,
    lng: data.lng,
    created_by_family_id: data.created_by_family_id ?? null,
    place_id: data.place_id ?? null,
  };
}

export async function getLandmarksByZip(zip: string): Promise<Landmark[]> {
  const snap = await getDocs(
    query(collection(db, "landmarks"), where("zip", "==", zip), orderBy("name"))
  );
  return snap.docs.map((d) => landmarkFromDoc(d.id, d.data()));
}

export async function getLandmarkById(id: string): Promise<Landmark | null> {
  const snap = await getDoc(doc(db, "landmarks", id));
  return snap.exists() ? landmarkFromDoc(snap.id, snap.data()) : null;
}

// Mute a landmark for a family — they stop getting broadcast pushes for it.
// Idempotent (doc id is the landmark id).
export async function muteLandmark(familyId: string, landmarkId: string) {
  await setDoc(doc(db, "families", familyId, "mutes", landmarkId), {
    created_at: new Date().toISOString(),
  });
}

export async function unmuteLandmark(familyId: string, landmarkId: string) {
  await deleteDoc(doc(db, "families", familyId, "mutes", landmarkId));
}

export async function getMutedLandmarkIds(familyId: string): Promise<Set<string>> {
  const snap = await getDocs(collection(db, "families", familyId, "mutes"));
  return new Set(snap.docs.map((d) => d.id));
}

// Find a landmark by its Google placeId, if one already exists. The catalog
// is public-read, so this reads across families — letting us reuse a friend's
// canonical row instead of duplicating it.
export async function getLandmarkByPlaceId(placeId: string): Promise<Landmark | null> {
  const snap = await getDocs(
    query(collection(db, "landmarks"), where("place_id", "==", placeId), limit(1))
  );
  const d = snap.docs[0];
  return d ? landmarkFromDoc(d.id, d.data()) : null;
}

// Create a user-contributed landmark, OR return the existing canonical row if
// this Google place is already on the map. `placeId` gives a place a stable
// identity so the same spot resolves to ONE shared row across families.
export async function createUserLandmark(params: {
  familyId: string;
  name: string;
  zip: string;
  category: Landmark["category"];
  emoji: string;
  lat: number;
  lng: number;
  placeId?: string | null;
}): Promise<{ landmark: Landmark; existed: boolean }> {
  if (params.placeId) {
    const existing = await getLandmarkByPlaceId(params.placeId);
    if (existing) return { landmark: existing, existed: true };
  }

  const ref = await addDoc(collection(db, "landmarks"), {
    name: params.name,
    zip: params.zip,
    category: params.category,
    emoji: params.emoji,
    lat: params.lat,
    lng: params.lng,
    created_by_family_id: params.familyId,
    place_id: params.placeId ?? null,
    created_at: new Date().toISOString(),
  });
  const snap = await getDoc(ref);
  return { landmark: landmarkFromDoc(snap.id, snap.data()), existed: false };
}

// Update a landmark you created. Rules limit this to creator-only.
export async function updateUserLandmark(
  id: string,
  updates: Partial<{
    name: string;
    category: Landmark["category"];
    emoji: string;
    lat: number;
    lng: number;
  }>
): Promise<Landmark> {
  await updateDoc(doc(db, "landmarks", id), updates);
  const snap = await getDoc(doc(db, "landmarks", id));
  return landmarkFromDoc(snap.id, snap.data());
}

// Delete a landmark you created. Rules gate this to creator-only.
export async function deleteUserLandmark(id: string): Promise<void> {
  await deleteDoc(doc(db, "landmarks", id));
}
