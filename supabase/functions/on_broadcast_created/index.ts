// ┌──────────────────────────────────────────────────────────────────────────┐
// │ on_broadcast_created — Expo Push fan-out                                  │
// │                                                                           │
// │ Trigger: Database Webhook on INSERT into public.broadcasts.              │
// │ Fans out a push notification to every friend of the broadcasting        │
// │ family, EXCEPT friends who muted this landmark (landmark_mutes).         │
// │                                                                           │
// │ Deploy:                                                                   │
// │   supabase functions deploy on_broadcast_created --no-verify-jwt         │
// │                                                                           │
// │ Then add a Database Webhook (Dashboard → Database → Webhooks):           │
// │   table: public.broadcasts   events: INSERT                              │
// │   method: POST  url: <function url>                                      │
// │   headers: Authorization: Bearer <SERVICE_ROLE_KEY>                      │
// └──────────────────────────────────────────────────────────────────────────┘

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface BroadcastRow {
  id: string;
  family_id: string;
  landmark_id: string;
  planned_at: string;
  message: string | null;
  kid_ids: string[];
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: BroadcastRow;
  old_record: BroadcastRow | null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// SERVICE_ROLE is required — we need to read friendships + push tokens
// across family boundaries, which RLS would block.
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as WebhookPayload;

    if (payload.type !== "INSERT" || payload.table !== "broadcasts") {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const broadcast = payload.record;

    // 1. Look up the broadcasting family + landmark details (for the push copy).
    const [{ data: family }, { data: landmark }] = await Promise.all([
      admin
        .from("families")
        .select("id, name")
        .eq("id", broadcast.family_id)
        .single(),
      admin
        .from("landmarks")
        .select("id, name, emoji")
        .eq("id", broadcast.landmark_id)
        .single(),
    ]);

    if (!family || !landmark) {
      return json({ error: "family or landmark not found" }, 404);
    }

    // 2. Audience = the broadcasting family's friends, by default. Every
    //    friend gets the push — EXCEPT those who muted this specific
    //    landmark (landmark_mutes). Mute is opt-out per place, so the
    //    common case (no mutes) pings everyone.
    const { data: friendRows, error: friendErr } = await admin
      .from("friendships")
      .select("friend_family_id")
      .eq("family_id", broadcast.family_id);

    if (friendErr) return json({ error: friendErr.message }, 500);

    let audienceFamilyIds = (friendRows ?? []).map(
      (r: any) => r.friend_family_id
    );
    if (audienceFamilyIds.length === 0) {
      return json({ sent: 0, reason: "no friends" }, 200);
    }

    // Drop friends who muted this landmark.
    const { data: muteRows } = await admin
      .from("landmark_mutes")
      .select("family_id")
      .eq("landmark_id", broadcast.landmark_id)
      .in("family_id", audienceFamilyIds);
    const mutedIds = new Set((muteRows ?? []).map((r: any) => r.family_id));
    if (mutedIds.size > 0) {
      audienceFamilyIds = audienceFamilyIds.filter((id: string) => !mutedIds.has(id));
    }
    if (audienceFamilyIds.length === 0) {
      return json({ sent: 0, reason: "all muted" }, 200);
    }

    // 3. Pull every push token for users in those families.
    const { data: tokenRows, error: tokErr } = await admin
      .from("users")
      .select("push_token")
      .in("family_id", audienceFamilyIds)
      .not("push_token", "is", null);

    if (tokErr) return json({ error: tokErr.message }, 500);

    const tokens = (tokenRows ?? [])
      .map((r: any) => r.push_token as string)
      .filter((t) => t && t.startsWith("ExponentPushToken"));

    if (tokens.length === 0) {
      return json({ sent: 0, reason: "no tokens" }, 200);
    }

    // 4. Build the push payload.
    const when = formatWhen(broadcast.planned_at);
    const title = `${landmark.emoji} ${family.name} → ${landmark.name}`;
    const body = broadcast.message
      ? `${when} · ${broadcast.message}`
      : `Heading over ${when.toLowerCase()}`;

    const messages = tokens.map((to) => ({
      to,
      title,
      body,
      sound: "default",
      data: {
        type: "broadcast",
        broadcastId: broadcast.id,
        landmarkId: landmark.id,
        familyId: family.id,
      },
      // Keep batches small per Expo docs (they chunk at 100).
      channelId: "broadcasts",
    }));

    // 5. Ship to Expo. Expo accepts arrays; chunk at 100 to be safe.
    const chunks = chunk(messages, 100);
    const receipts: any[] = [];
    for (const batch of chunks) {
      const r = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(batch),
      });
      const parsed = await r.json().catch(() => ({}));
      receipts.push(parsed);
    }

    return json({ sent: tokens.length, audienceFamilies: audienceFamilyIds.length, receipts }, 200);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

// ─── helpers ────────────────────────────────────────────────────────────────

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Friendly relative time: "now", "in 15 min", "at 3:30 PM", "tomorrow at 9 AM"
function formatWhen(iso: string): string {
  const planned = new Date(iso);
  const now = new Date();
  const diffMin = Math.round((planned.getTime() - now.getTime()) / 60000);

  if (diffMin <= 5 && diffMin >= -5) return "Now";
  if (diffMin > 5 && diffMin < 60) return `In ${diffMin} min`;

  const sameDay =
    planned.getFullYear() === now.getFullYear() &&
    planned.getMonth() === now.getMonth() &&
    planned.getDate() === now.getDate();

  const t = planned.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) return `At ${t}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    planned.getFullYear() === tomorrow.getFullYear() &&
    planned.getMonth() === tomorrow.getMonth() &&
    planned.getDate() === tomorrow.getDate();

  if (isTomorrow) return `Tomorrow at ${t}`;

  return planned.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }) + ` at ${t}`;
}
