// ┌──────────────────────────────────────────────────────────────────────────┐
// │ on_friend_request_created — push when someone requests to friend you    │
// │                                                                           │
// │ Trigger: pg_net call from public.dispatch_friend_request_push()         │
// │   on INSERT into public.friend_requests.                                │
// │                                                                           │
// │ Looks up the sender's family name + recipient's push tokens (every     │
// │ user in the recipient family — they might share a tablet etc.)         │
// │                                                                           │
// │ Deploy: supabase functions deploy on_friend_request_created --no-verify-jwt │
// └──────────────────────────────────────────────────────────────────────────┘

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface FriendRequestRow {
  id: string;
  from_family_id: string;
  to_family_id: string;
  status: string;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: FriendRequestRow;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    if (payload.type !== "INSERT" || payload.table !== "friend_requests") {
      return json({ skipped: true }, 200);
    }

    const request = payload.record;

    // Look up sender's family name (for the push body).
    const { data: senderFamily, error: senderErr } = await admin
      .from("families")
      .select("name")
      .eq("id", request.from_family_id)
      .single();
    if (senderErr || !senderFamily) {
      return json({ error: "sender not found" }, 404);
    }

    // Push tokens of every user in the recipient family.
    const { data: tokenRows, error: tokErr } = await admin
      .from("users")
      .select("push_token")
      .eq("family_id", request.to_family_id)
      .not("push_token", "is", null);
    if (tokErr) return json({ error: tokErr.message }, 500);

    const tokens = (tokenRows ?? [])
      .map((r: any) => r.push_token as string)
      .filter((t) => t && t.startsWith("ExponentPushToken"));
    if (tokens.length === 0) {
      return json({ sent: 0, reason: "no tokens" }, 200);
    }

    const messages = tokens.map((to) => ({
      to,
      title: "New friend request",
      body: `${senderFamily.name} wants to follow your outings`,
      sound: "default",
      data: {
        type: "friend_request",
        requestId: request.id,
        fromFamilyId: request.from_family_id,
      },
      channelId: "friend_requests",
    }));

    const r = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });
    const receipts = await r.json().catch(() => ({}));

    return json({ sent: tokens.length, receipts }, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
