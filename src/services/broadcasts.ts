import { supabase } from "@/config/supabase";
import { Broadcast, BroadcastFeedItem } from "@/types";

export async function createBroadcast(params: {
  familyId: string;
  landmarkId: string;
  plannedAt: Date;
  message?: string | null;
  kidIds?: string[];
}): Promise<Broadcast> {
  const { data, error } = await supabase
    .from("broadcasts")
    .insert({
      family_id: params.familyId,
      landmark_id: params.landmarkId,
      planned_at: params.plannedAt.toISOString(),
      message: params.message ?? null,
      kid_ids: params.kidIds ?? [],
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Broadcast;
}

export async function endBroadcast(id: string) {
  const { error } = await supabase
    .from("broadcasts")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Feed = active broadcasts by self + friend families, enriched with
// family + landmark for rendering. RLS does the friend-visibility filter.
export async function getActiveFeed(): Promise<BroadcastFeedItem[]> {
  const { data, error } = await supabase
    .from("broadcasts")
    .select(`
      *,
      families:family_id ( name, avatar_url ),
      landmarks:landmark_id ( name, emoji )
    `)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("planned_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    family_name: row.families?.name ?? "Unknown",
    family_avatar_url: row.families?.avatar_url ?? null,
    landmark_name: row.landmarks?.name ?? "Unknown",
    landmark_emoji: row.landmarks?.emoji ?? "📍",
  })) as BroadcastFeedItem[];
}

export async function getActiveBroadcastsForLandmark(
  landmarkId: string
): Promise<BroadcastFeedItem[]> {
  const { data, error } = await supabase
    .from("broadcasts")
    .select(`
      *,
      families:family_id ( name, avatar_url ),
      landmarks:landmark_id ( name, emoji )
    `)
    .eq("landmark_id", landmarkId)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("planned_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    family_name: row.families?.name ?? "Unknown",
    family_avatar_url: row.families?.avatar_url ?? null,
    landmark_name: row.landmarks?.name ?? "Unknown",
    landmark_emoji: row.landmarks?.emoji ?? "📍",
  })) as BroadcastFeedItem[];
}
