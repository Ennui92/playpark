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

// Mute a landmark for a family — they stop getting broadcast pushes for it.
// Friend broadcasts notify everyone by default; this is the per-place opt-out.
// Idempotent thanks to PK (family_id, landmark_id).
export async function muteLandmark(familyId: string, landmarkId: string) {
  const { error } = await supabase
    .from("landmark_mutes")
    .upsert({ family_id: familyId, landmark_id: landmarkId });
  if (error) throw error;
}

export async function unmuteLandmark(familyId: string, landmarkId: string) {
  const { error } = await supabase
    .from("landmark_mutes")
    .delete()
    .eq("family_id", familyId)
    .eq("landmark_id", landmarkId);
  if (error) throw error;
}

export async function getMutedLandmarkIds(familyId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("landmark_mutes")
    .select("landmark_id")
    .eq("family_id", familyId);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.landmark_id));
}

// Find a landmark by its Google placeId, if one already exists. RLS
// landmarks_select is `using(true)`, so this reads across families —
// letting us reuse a friend's canonical row instead of duplicating it.
export async function getLandmarkByPlaceId(placeId: string): Promise<Landmark | null> {
  const { data, error } = await supabase
    .from("landmarks")
    .select("*")
    .eq("place_id", placeId)
    .maybeSingle();
  if (error) throw error;
  return (data as Landmark) ?? null;
}

// Create a user-contributed landmark, OR return the existing canonical row
// if this Google place is already on the map. RLS requires
// created_by_family_id to match the caller's family on insert.
//
// `placeId` (from Google autocomplete) gives the place a stable identity:
// the same real-world spot resolves to ONE row shared across families, so
// pins aren't duplicated and "notify me on this place" subscriptions all
// point at the same landmark. Manually-pinned places pass no placeId and
// keep the plain insert behaviour.
//
// Returns `{ landmark, existed }` so the caller can tailor the success copy
// ("added" vs "already on the map").
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
  // Dedup: if this Google place is already on the map, reuse it.
  if (params.placeId) {
    const existing = await getLandmarkByPlaceId(params.placeId);
    if (existing) return { landmark: existing, existed: true };
  }

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
      place_id: params.placeId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    // Unique-violation race: two devices added the same place at once.
    // Fall back to the row the other insert won, instead of failing.
    if ((error as any).code === "23505" && params.placeId) {
      const existing = await getLandmarkByPlaceId(params.placeId);
      if (existing) return { landmark: existing, existed: true };
    }
    throw error;
  }
  return { landmark: data as Landmark, existed: false };
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
