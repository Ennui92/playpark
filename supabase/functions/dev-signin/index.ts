// ┌──────────────────────────────────────────────────────────────────────────┐
// │ dev-signin — dev-only backdoor auth                                       │
// │                                                                           │
// │ Client calls POST { email } with no auth needed.                          │
// │ Function uses service-role to:                                            │
// │   1. Create the user if absent (email_confirm: true — no email sent)     │
// │   2. Generate a magic-link token WITHOUT sending an email                │
// │   3. Return the hashed_token so the client can verifyOtp locally         │
// │                                                                           │
// │ Deploy: supabase functions deploy dev-signin --no-verify-jwt             │
// │                                                                           │
// │ ⚠️  Gated behind env var ALLOW_DEV_SIGNIN=1. To turn the backdoor OFF    │
// │     for production, unset the variable in the Supabase dashboard         │
// │     (Project Settings → Edge Functions → Environment Variables).         │
// │     With the var unset, this function returns 403 to every request.     │
// └──────────────────────────────────────────────────────────────────────────┘

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOW_DEV_SIGNIN = Deno.env.get("ALLOW_DEV_SIGNIN") === "1";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  try {
    if (!ALLOW_DEV_SIGNIN) {
      return json({ error: "dev sign-in disabled" }, 403);
    }

    const { email } = (await req.json()) as { email?: string };
    if (!email || !email.includes("@")) {
      return json({ error: "email required" }, 400);
    }

    // 1. Upsert the user (admin API — no email is ever sent).
    //    `email_confirm: true` skips the verification step entirely.
    //    If the user already exists, createUser returns a 422; we ignore it.
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    // If user already exists this returns an error with status 422/409; fine.
    if (created.error && !/already|exists|duplicate/i.test(created.error.message)) {
      return json({ error: created.error.message }, 500);
    }

    // 2. Generate a magic-link token *without sending an email*.
    //    generateLink returns properties.hashed_token which the client can
    //    exchange via supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error) return json({ error: error.message }, 500);

    const hashedToken = (data as any)?.properties?.hashed_token;
    if (!hashedToken) return json({ error: "no token returned" }, 500);

    return json({ hashed_token: hashedToken });
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
