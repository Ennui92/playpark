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

// Pick a square image, upload to Firebase Storage at avatars/<family_id>.jpg,
// and update families.avatar_url with the download URL.
//
// We upload a real Blob from fetch(uri).blob(). Passing a Uint8Array/ArrayBuffer
// to uploadBytes makes the SDK do `new Blob([arrayBuffer])`, which React Native
// does not support ("creating blob from arraybuffer and arraybufferview are not
// supported"). A fetched Blob sidesteps that and is the standard Expo path.
export async function pickAndUploadAvatar(familyId: string): Promise<string> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Photo access denied");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) throw new Error("Cancelled");

  const uri = result.assets[0].uri;
  if (!uri) throw new Error("Could not read image");
  const blob = await (await fetch(uri)).blob();

  const path = `avatars/${familyId}.jpg`;
  const r = storageRef(storage, path);
  await uploadBytes(r, blob, { contentType: "image/jpeg", cacheControl: "3600" });

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
