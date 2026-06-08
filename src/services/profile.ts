import { supabase } from "@/config/supabase";
import { Family } from "@/types";
import * as ImagePicker from "expo-image-picker";

const AVATAR_BUCKET = "avatars";

// Pick a square image from the library, upload to Supabase Storage at
// `<family_id>.jpg`, and update families.avatar_url with the public URL.
// Returns the new public URL on success.
export async function pickAndUploadAvatar(familyId: string): Promise<string> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Photo access denied");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]) {
    throw new Error("Cancelled");
  }
  const uri = result.assets[0].uri;
  const blob = await fetch(uri).then((r) => r.blob());

  const path = `${familyId}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });
  if (upErr) throw upErr;

  // Bust the cache so the new image renders immediately rather than
  // showing a stale upload.
  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const cacheBusted = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: famErr } = await supabase
    .from("families")
    .update({ avatar_url: cacheBusted })
    .eq("id", familyId);
  if (famErr) throw famErr;

  return cacheBusted;
}

export async function updateFamilyProfile(
  familyId: string,
  updates: { name?: string; bio?: string | null }
): Promise<Family> {
  const { data, error } = await supabase
    .from("families")
    .update(updates)
    .eq("id", familyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Family;
}

export async function getFamilyById(id: string): Promise<Family | null> {
  const { data, error } = await supabase
    .from("families")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Family) ?? null;
}

// Quick "what is my family up to?" stats for a friend profile.
// Returns active broadcast count + landmarks contributed.
export async function getFamilyActivity(familyId: string): Promise<{
  activeBroadcasts: number;
  landmarksContributed: number;
}> {
  const [bc, lm] = await Promise.all([
    supabase
      .from("broadcasts")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId)
      .is("ended_at", null)
      .gt("expires_at", new Date().toISOString()),
    supabase
      .from("landmarks")
      .select("id", { count: "exact", head: true })
      .eq("created_by_family_id", familyId),
  ]);
  return {
    activeBroadcasts: bc.count ?? 0,
    landmarksContributed: lm.count ?? 0,
  };
}
