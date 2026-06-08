// ┌──────────────────────────────────────────────────────────────────────────┐
// │ on_broadcast_updated — push when a broadcaster changes their status     │
// │                                                                           │
// │ Trigger: dispatch_broadcast_update_push fires on UPDATE of               │
// │   public.broadcasts when EITHER the message changed OR ended_at         │
// │   transitioned null → not-null. The trigger already filters; we just    │
// │   need to fan out the push.                                             │
// │                                                                           │
// │ Audience: RSVPed-coming + RSVPed-maybe families. Skips the broadcaster. │
// │ Falls back to "all friend families subscribed to the landmark" if no   │
// │ RSVPs exist yet (so the initial "I'm here!" still reaches people).     │
// └──────────────────────────────────────────────────────────────────────────┘

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface BroadcastRow {
  id: string;
  family_id: string;
  landmark_id: string;
  message: string | null;
  ended_at: string | null;
}

interface WebhookPayload {
  type: "UPDATE";
  table: string;
  schema: string;
  record: BroadcastRow;
  old_record: BroadcastRow;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    if (payload.type !== "UPDATE" || payload.table !== "broadcasts") {
      return json({ skipped: true }, 200);
    }

    const cur = payload.record;
    const prev = payload.old_record;
    const justEnded = !prev.ended_at && !!cur.ended_at;
    const messageChanged =
      (cur.message ?? "") !== (prev.message ?? "");
    if (!justEnded && !messageChanged) {
      return json({ skipped: true, reason: "no status change" }, 200);
    }

    // Look up family + landmark for the push copy.
    const [{ data: family }, { data: landmark }] = await Promise.all([
      admin.from("families").select("name").eq("id", cur.family_id).single(),
      admin.from("landmarks").select("name, emoji").eq("id", cur.landmark_id).single(),
    ]);
    if (!family || !landmark) {
      return json({ error: "family or landmark not found" }, 404);
    }

    // Audience: families that RSVPed coming/maybe to this broadcast.
    const { data: rsvpRows } = await admin
      .from("broadcast_rsvps")
      .select("family_id")
      .eq("broadcast_id", cur.id)
      .in("status", ["coming", "maybe"]);
    let audienceFamilyIds = (rsvpRows ?? [])
      .map((r: any) => r.family_id as string)
      .filter((id) => id !== cur.family_id);

    // Fallback: if no RSVPs yet, fan out to ALL friend families (same
    // model as on_broadcast_created — no per-landmark opt-in required).
    if (audienceFamilyIds.length === 0) {
      const { data: friendRows } = await admin
        .from("friendships")
        .select("friend_family_id")
        .eq("family_id", cur.family_id);
      audienceFamilyIds = (friendRows ?? []).map(
        (r: any) => r.friend_family_id
      );
    }
    if (audienceFamilyIds.length === 0) {
      return json({ sent: 0, reason: "no audience" }, 200);
    }

    // Push tokens for those families.
    const { data: tokenRows } = await admin
      .from("users")
      .select("push_token")
      .in("family_id", audienceFamilyIds)
      .not("push_token", "is", null);
    const tokens = (tokenRows ?? [])
      .map((r: any) => r.push_token as string)
      .filter((t) => t && t.startsWith("ExponentPushToken"));
    if (tokens.length === 0) {
      return json({ sent: 0, reason: "no tokens" }, 200);
    }

    let title: string;
    let body: string;
    if (justEnded) {
      title = `${landmark.emoji} ${family.name} wrapped up`;
      body = cur.message ?? `Outing at ${landmark.name} ended`;
    } else {
      title = `${landmark.emoji} ${family.name} — update`;
      body = cur.message ?? `Status update at ${landmark.name}`;
    }

    const messages = tokens.map((to) => ({
      to,
      title,
      body,
      sound: "default",
      data: {
        type: "broadcast",
        broadcastId: cur.id,
        landmarkId: cur.landmark_id,
        familyId: cur.family_id,
        update: true,
        ended: justEnded,
      },
      channelId: "broadcasts",
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
