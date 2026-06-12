import { supabase } from "@/config/supabase";
import { Landmark } from "@/types";

export async function getFavoriteLandmarkIds(familyId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("landmark_favorites")
    .select("landmark_id")
    .eq("family_id", familyId);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.landmark_id));
}

// Full landmark rows for everything I've saved — INCLUDING places outside
// my postal code. This is what lets a saved spot anywhere show up in "my
// places" (Home), and what makes broadcasting outside my PLZ work: save it
// once, it stays in your list. RLS landmarks_select is `using(true)`, so the
// join reads places any family created.
export async function getFavoriteLandmarks(familyId: string): Promise<Landmark[]> {
  const { data, error } = await supabase
    .from("landmark_favorites")
    .select("landmarks:landmark_id ( * )")
    .eq("family_id", familyId);
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => r.landmarks)
    .filter(Boolean) as Landmark[];
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
