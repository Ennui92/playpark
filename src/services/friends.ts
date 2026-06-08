import { supabase } from "@/config/supabase";
import { Family, FriendRequest } from "@/types";

export async function generateQrNonce(): Promise<string> {
  const { data, error } = await supabase.rpc("generate_qr_nonce");
  if (error) throw error;
  return data as string;
}

export async function addFriendViaQr(nonce: string): Promise<string> {
  const { data, error } = await supabase.rpc("add_friend_via_qr", { _nonce: nonce });
  if (error) throw error;
  return data as string;
}

export async function addFriendViaUsername(username: string): Promise<string> {
  const { data, error } = await supabase.rpc("add_friend_via_username", {
    _username: username,
  });
  if (error) throw error;
  return data as string;
}

export async function removeFriendship(otherFamilyId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_friendship", {
    _other_family: otherFamilyId,
  });
  if (error) throw error;
}

export async function getFriendFamilies(myFamilyId: string): Promise<Family[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("friend_family_id, families:friend_family_id ( * )")
    .eq("family_id", myFamilyId);
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => r.families)
    .filter(Boolean) as Family[];
}

export async function searchUsername(prefix: string) {
  const { data, error } = await supabase.rpc("search_username", {
    _prefix: prefix.toLowerCase(),
  });
  if (error) throw error;
  return (data ?? []) as { family_id: string; family_name: string; username: string }[];
}

// ─── Friend requests ──────────────────────────────────────────────────────

// Incoming requests addressed to me (the recipient). RLS filters to those
// where to_family_id = auth_family_id().
export async function getPendingFriendRequests(): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from("friend_requests")
    .select(`
      id, from_family_id, to_family_id, created_at,
      families:from_family_id ( name, zip )
    `)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    from_family_id: r.from_family_id,
    to_family_id: r.to_family_id,
    created_at: r.created_at,
    from_family_name: r.families?.name ?? "Someone",
    from_family_zip: r.families?.zip ?? "—",
  }));
}

// Convenience: count of pending requests, for tab badge.
export async function getPendingRequestCount(myFamilyId: string): Promise<number> {
  const { count, error } = await supabase
    .from("friend_requests")
    .select("id", { count: "exact", head: true })
    .eq("to_family_id", myFamilyId);
  if (error) throw error;
  return count ?? 0;
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_friend_request", {
    _request_id: requestId,
  });
  if (error) throw error;
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_friend_request", {
    _request_id: requestId,
  });
  if (error) throw error;
}
