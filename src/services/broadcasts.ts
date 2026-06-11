import { supabase } from "@/config/supabase";
import { Broadcast, BroadcastFeedItem, BroadcastRsvpRow, RsvpStatus } from "@/types";

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

export async function endBroadcast(id: string, finalMessage?: string | null) {
  const update: Record<string, any> = { ended_at: new Date().toISOString() };
  if (finalMessage !== undefined) update.message = finalMessage;
  const { error } = await supabase
    .from("broadcasts")
    .update(update)
    .eq("id", id);
  if (error) throw error;
}

// Update the broadcast's status message ("Running 10 min late", etc.).
// Triggers a push to RSVPed friends via dispatch_broadcast_update_push().
export async function updateBroadcastMessage(
  id: string,
  message: string | null
) {
  const { error } = await supabase
    .from("broadcasts")
    .update({ message })
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

// My single active broadcast (any landmark), or null. The "one active
// broadcast" guard is global per family, so this is how a screen knows
// whether I'm already out — even if I'm looking at a different place.
export async function getMyActiveBroadcast(
  familyId: string
): Promise<BroadcastFeedItem | null> {
  const { data, error } = await supabase
    .from("broadcasts")
    .select(`
      *,
      families:family_id ( name, avatar_url ),
      landmarks:landmark_id ( name, emoji )
    `)
    .eq("family_id", familyId)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const row: any = data;
  return {
    ...row,
    family_name: row.families?.name ?? "Unknown",
    family_avatar_url: row.families?.avatar_url ?? null,
    landmark_name: row.landmarks?.name ?? "Unknown",
    landmark_emoji: row.landmarks?.emoji ?? "📍",
  } as BroadcastFeedItem;
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

// ─── RSVPs ────────────────────────────────────────────────────────────────

export async function setBroadcastRsvp(
  broadcastId: string,
  status: RsvpStatus
): Promise<void> {
  const { error } = await supabase.rpc("set_broadcast_rsvp", {
    _broadcast_id: broadcastId,
    _status: status,
  });
  if (error) throw error;
}

// All RSVPs visible to me for a broadcast, enriched with the responder's
// family name. RLS handles whether I'm allowed to see them (I am, if I'm
// the broadcaster or a friend of the broadcaster).
export async function getRsvpsForBroadcast(
  broadcastId: string
): Promise<BroadcastRsvpRow[]> {
  const { data, error } = await supabase
    .from("broadcast_rsvps")
    .select(`
      broadcast_id, family_id, status, created_at, updated_at,
      families:family_id ( name, avatar_url )
    `)
    .eq("broadcast_id", broadcastId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    broadcast_id: r.broadcast_id,
    family_id: r.family_id,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
    family_name: r.families?.name ?? "Someone",
    family_avatar_url: r.families?.avatar_url ?? null,
  })) as BroadcastRsvpRow[];
}

// What's MY current RSVP on a given broadcast, if any?
export async function getMyRsvp(
  broadcastId: string,
  myFamilyId: string
): Promise<RsvpStatus | null> {
  const { data, error } = await supabase
    .from("broadcast_rsvps")
    .select("status")
    .eq("broadcast_id", broadcastId)
    .eq("family_id", myFamilyId)
    .maybeSingle();
  if (error) throw error;
  return (data?.status as RsvpStatus) ?? null;
}
