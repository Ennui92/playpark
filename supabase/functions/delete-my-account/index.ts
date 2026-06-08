// ┌──────────────────────────────────────────────────────────────────────────┐
// │ delete-my-account — irreversibly remove the caller's account             │
// │                                                                           │
// │ Required by Google Play Store: any app with sign-in must let users       │
// │ delete their account in-app, not only via email request.                 │
// │                                                                           │
// │ Flow:                                                                     │
// │   1. Verify the caller's JWT (the Edge runtime checks it for us; we     │
// │      then re-read it to pull the auth user id).                          │
// │   2. Look up the user's family_id and count other members of that       │
// │      family. If they're the sole member, drop the family — that         │
// │      cascades broadcasts, kids, friendships, landmark_subs, qr_nonces,  │
// │      favorites. User-contributed landmarks have ON DELETE SET NULL on   │
// │      created_by_family_id so they survive (the catalogue stays).        │
// │   3. Delete the auth user with the service-role admin client. The       │
// │      public.users row cascades from that delete.                        │
// │                                                                           │
// │ Deploy: supabase functions deploy delete-my-account                      │
// │ Verification: must run AS the caller, so JWT check stays ON.            │
// └──────────────────────────────────────────────────────────────────────────┘

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  try {
    // Extract the caller's JWT from the Authorization header. The Edge
    // runtime already validates it but we need the user id from inside.
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "missing auth" }, 401);

    // Use an anon-key client with the user's JWT to resolve "who is this?"
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userResp, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userResp?.user) {
      return json({ error: "invalid auth" }, 401);
    }
    const userId = userResp.user.id;

    // ─── Resolve family + whether user is the sole member ───────────────
    const { data: meRow, error: meErr } = await admin
      .from("users")
      .select("family_id")
      .eq("id", userId)
      .maybeSingle();
    if (meErr) return json({ error: meErr.message }, 500);

    const familyId = meRow?.family_id ?? null;
    let droppedFamily = false;

    if (familyId) {
      const { count, error: countErr } = await admin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("family_id", familyId);
      if (countErr) return json({ error: countErr.message }, 500);

      if ((count ?? 0) <= 1) {
        // Sole member — drop the family. Cascades broadcasts / kids /
        // friendships / landmark_subs / qr_nonces / favorites.
        const { error: famErr } = await admin
          .from("families")
          .delete()
          .eq("id", familyId);
        if (famErr) return json({ error: famErr.message }, 500);
        droppedFamily = true;
      }
    }

    // ─── Drop the auth user (cascades public.users) ─────────────────────
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) return json({ error: authErr.message }, 500);

    return json({ ok: true, droppedFamily });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
