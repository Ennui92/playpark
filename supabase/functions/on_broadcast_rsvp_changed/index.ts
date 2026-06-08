// ┌──────────────────────────────────────────────────────────────────────────┐
// │ on_broadcast_rsvp_changed — push the broadcaster when a friend RSVPs    │
// │                                                                           │
// │ Trigger: pg_net call from public.dispatch_rsvp_push() on INSERT and     │
// │   UPDATE of public.broadcast_rsvps. Update fires when status changes.   │
// │                                                                           │
// │ Pushes a single notification to every user in the broadcasting family.  │
// │ Skips the case where someone RSVPs to their OWN broadcast (broadcaster  │
// │ doesn't need a notification about themselves).                          │
// │                                                                           │
// │ Deploy: supabase functions deploy on_broadcast_rsvp_changed --no-verify-jwt │
// └──────────────────────────────────────────────────────────────────────────┘

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface RsvpRow {
  broadcast_id: string;
  family_id: string;
  status: "coming" | "maybe" | "not_coming";
  created_at: string;
  updated_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: RsvpRow;
  old_record: RsvpRow | null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const STATUS_VERB: Record<RsvpRow["status"], string> = {
  coming: "is coming",
  maybe: "might come",
  not_coming: "can't make it",
};

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    if (payload.table !== "broadcast_rsvps") {
      return json({ skipped: true }, 200);
    }
    if (payload.type !== "INSERT" && payload.type !== "UPDATE") {
      return json({ skipped: true }, 200);
    }
    // Skip silent no-ops where status didn't change.
    if (
      payload.type === "UPDATE" &&
      payload.old_record &&
      payload.old_record.status === payload.record.status
    ) {
      return json({ skipped: true, reason: "no status change" }, 200);
    }

    const rsvp = payload.record;

    // Look up the broadcast → broadcasting family + landmark.
    const { data: broadcast, error: bErr } = await admin
      .from("broadcasts")
      .select("family_id, landmark_id")
      .eq("id", rsvp.broadcast_id)
      .single();
    if (bErr || !broadcast) {
      return json({ error: "broadcast not found" }, 404);
    }

    // Don't notify the broadcaster about their own RSVP.
    if (broadcast.family_id === rsvp.family_id) {
      return json({ skipped: true, reason: "self rsvp" }, 200);
    }

    // Look up the RSVPing family name + the landmark (for push body).
    const [{ data: rsvpFamily }, { data: landmark }] = await Promise.all([
      admin.from("families").select("name").eq("id", rsvp.family_id).single(),
      admin.from("landmarks").select("name, emoji").eq("id", broadcast.landmark_id).single(),
    ]);
    if (!rsvpFamily || !landmark) {
      return json({ error: "family or landmark not found" }, 404);
    }

    // Push tokens of every user in the BROADCASTING family.
    const { data: tokenRows, error: tokErr } = await admin
      .from("users")
      .select("push_token")
      .eq("family_id", broadcast.family_id)
      .not("push_token", "is", null);
    if (tokErr) return json({ error: tokErr.message }, 500);

    const tokens = (tokenRows ?? [])
      .map((r: any) => r.push_token as string)
      .filter((t) => t && t.startsWith("ExponentPushToken"));
    if (tokens.length === 0) {
      return json({ sent: 0, reason: "no tokens" }, 200);
    }

    const verb = STATUS_VERB[rsvp.status];
    const title = `${landmark.emoji} ${rsvpFamily.name} ${verb}`;
    const body = `to ${landmark.name}`;

    const messages = tokens.map((to) => ({
      to,
      title,
      body,
      sound: "default",
      data: {
        type: "rsvp",
        broadcastId: rsvp.broadcast_id,
        landmarkId: broadcast.landmark_id,
        rsvpFamilyId: rsvp.family_id,
        status: rsvp.status,
      },
      channelId: "rsvps",
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
