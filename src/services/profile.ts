import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getCountFromServer,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { db, storage } from "@/config/firebase";
import { Family } from "@/types";

// Decode a base64 string to a byte array. React Native's Hermes engine has a
// global atob() (RN 0.74+), so no extra dependency is needed.
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Pick a square image, upload to Firebase Storage at avatars/<family_id>.jpg,
// and update families.avatar_url with the download URL. We upload raw bytes
// decoded from base64 (NOT fetch(uri).blob(), which is unreliable on RN).
export async function pickAndUploadAvatar(familyId: string): Promise<string> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Photo access denied");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]) throw new Error("Cancelled");

  const b64 = result.assets[0].base64;
  if (!b64) throw new Error("Could not read image data");
  const bytes = base64ToBytes(b64);

  const path = `avatars/${familyId}.jpg`;
  const r = storageRef(storage, path);
  await uploadBytes(r, bytes, { contentType: "image/jpeg", cacheControl: "3600" });

  const url = await getDownloadURL(r);
  // Bust the cache so the new image renders immediately.
  const cacheBusted = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;

  await updateDoc(doc(db, "families", familyId), { avatar_url: cacheBusted });
  return cacheBusted;
}

export async function updateFamilyProfile(
  familyId: string,
  updates: { name?: string; bio?: string | null }
): Promise<Family> {
  await updateDoc(doc(db, "families", familyId), updates);
  const snap = await getDoc(doc(db, "families", familyId));
  return { id: snap.id, ...(snap.data() as Omit<Family, "id">) };
}

export async function getFamilyById(id: string): Promise<Family | null> {
  const snap = await getDoc(doc(db, "families", id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Family, "id">) } : null;
}

// Quick "what is my family up to?" stats for a friend profile.
export async function getFamilyActivity(familyId: string): Promise<{
  activeBroadcasts: number;
  landmarksContributed: number;
}> {
  const nowIso = new Date().toISOString();
  const [bc, lm] = await Promise.all([
    getCountFromServer(
      query(
        collection(db, "broadcasts"),
        where("family_id", "==", familyId),
        where("ended_at", "==", null),
        where("expires_at", ">", nowIso)
      )
    ),
    getCountFromServer(
      query(collection(db, "landmarks"), where("created_by_family_id", "==", familyId))
    ),
  ]);
  return {
    activeBroadcasts: bc.data().count,
    landmarksContributed: lm.data().count,
  };
}
