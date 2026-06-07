import { supabase } from "@/config/supabase";
import { Landmark } from "@/types";

export async function getLandmarksByZip(zip: string): Promise<Landmark[]> {
  const { data, error } = await supabase
    .from("landmarks")
    .select("*")
    .eq("zip", zip)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Landmark[];
}

export async function getLandmarkById(id: string): Promise<Landmark | null> {
  const { data, error } = await supabase
    .from("landmarks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Landmark) ?? null;
}

// Subscribe (family → landmark). Idempotent thanks to PK (family_id, landmark_id).
export async function subscribeToLandmark(familyId: string, landmarkId: string) {
  const { error } = await supabase
    .from("landmark_subs")
    .upsert({ family_id: familyId, landmark_id: landmarkId });
  if (error) throw error;
}

export async function unsubscribeFromLandmark(familyId: string, landmarkId: string) {
  const { error } = await supabase
    .from("landmark_subs")
    .delete()
    .eq("family_id", familyId)
    .eq("landmark_id", landmarkId);
  if (error) throw error;
}

export async function getSubscribedLandmarkIds(familyId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("landmark_subs")
    .select("landmark_id")
    .eq("family_id", familyId);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.landmark_id));
}

// Create a user-contributed landmark. RLS requires created_by_family_id
// to match the caller's family.
export async function createUserLandmark(params: {
  familyId: string;
  name: string;
  zip: string;
  category: Landmark["category"];
  emoji: string;
  lat: number;
  lng: number;
}): Promise<Landmark> {
  const { data, error } = await supabase
    .from("landmarks")
    .insert({
      name: params.name,
      zip: params.zip,
      category: params.category,
      emoji: params.emoji,
      lat: params.lat,
      lng: params.lng,
      created_by_family_id: params.familyId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Landmark;
}

// Update a landmark you created. RLS limits this to rows where
// created_by_family_id = your family.
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
  const { data, error } = await supabase
    .from("landmarks")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Landmark;
}

// Delete a landmark you created. RLS gates this to creator-only.
export async function deleteUserLandmark(id: string): Promise<void> {
  const { error } = await supabase.from("landmarks").delete().eq("id", id);
  if (error) throw error;
}
