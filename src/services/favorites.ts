import { supabase } from "@/config/supabase";

export async function getFavoriteLandmarkIds(familyId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("landmark_favorites")
    .select("landmark_id")
    .eq("family_id", familyId);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.landmark_id));
}

export async function favoriteLandmark(familyId: string, landmarkId: string) {
  const { error } = await supabase
    .from("landmark_favorites")
    .upsert({ family_id: familyId, landmark_id: landmarkId });
  if (error) throw error;
}

export async function unfavoriteLandmark(familyId: string, landmarkId: string) {
  const { error } = await supabase
    .from("landmark_favorites")
    .delete()
    .eq("family_id", familyId)
    .eq("landmark_id", landmarkId);
  if (error) throw error;
}
