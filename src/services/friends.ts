import { supabase } from "@/config/supabase";
import { Family } from "@/types";

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
