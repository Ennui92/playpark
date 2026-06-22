import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { Landmark } from "@/types";

export async function getFavoriteLandmarkIds(familyId: string): Promise<Set<string>> {
  const snap = await getDocs(collection(db, "families", familyId, "favorites"));
  return new Set(snap.docs.map((d) => d.id));
}

// Full landmark rows for everything I've saved — INCLUDING places outside my
// postal code. The catalog is public-read, so we fetch each saved landmark by
// id. This is what makes broadcasting outside my PLZ work: save it once, it
// stays in your list.
export async function getFavoriteLandmarks(familyId: string): Promise<Landmark[]> {
  const favSnap = await getDocs(collection(db, "families", familyId, "favorites"));
  const landmarks = await Promise.all(
    favSnap.docs.map(async (f) => {
      const lm = await getDoc(doc(db, "landmarks", f.id));
      if (!lm.exists()) return null;
      const data = lm.data();
      return {
        id: lm.id,
        name: data.name,
        zip: data.zip,
        category: data.category,
        emoji: data.emoji,
        lat: data.lat,
        lng: data.lng,
        created_by_family_id: data.created_by_family_id ?? null,
        place_id: data.place_id ?? null,
      } as Landmark;
    })
  );
  return landmarks.filter((l): l is Landmark => l !== null);
}

export async function favoriteLandmark(familyId: string, landmarkId: string) {
  await setDoc(doc(db, "families", familyId, "favorites", landmarkId), {
    created_at: new Date().toISOString(),
  });
}

export async function unfavoriteLandmark(familyId: string, landmarkId: string) {
  await deleteDoc(doc(db, "families", familyId, "favorites", landmarkId));
}
