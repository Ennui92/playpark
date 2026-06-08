import Constants from "expo-constants";
import { supabase } from "@/config/supabase";

// Dev backdoor: typing this as the OTP signs any email in without an actual
// email. Remove / env-gate before shipping to real users.
const DEV_MAGIC_CODE = "123456";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

// Magic-link / OTP style email auth. Passwordless keeps onboarding friction low.
export async function sendEmailOtp(email: string) {
  // Try the real OTP send. If it fails (rate limit, etc.) we swallow the
  // error so the user can still advance to the code screen and use the dev
  // backdoor. The error is logged so real problems are visible in Metro.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    console.warn("[auth] sendEmailOtp failed (ok for dev):", error.message);
  }
}

export async function verifyEmailOtp(email: string, token: string) {
  // ── Dev backdoor ─────────────────────────────────────────────────────────
  if (token.trim() === DEV_MAGIC_CODE) {
    const url = extra.supabaseUrl;
    const anonKey = extra.supabaseAnonKey;
    if (!url || !anonKey) throw new Error("missing supabase config");

    const resp = await fetch(`${url}/functions/v1/dev-signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify({ email }),
    });
    const body = await resp.json();
    if (!resp.ok) throw new Error(body?.error ?? `dev-signin ${resp.status}`);

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: body.hashed_token,
      type: "magiclink",
    });
    if (error) throw error;
    return data;
  }

  // ── Real OTP path ────────────────────────────────────────────────────────
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw error;
  return data;
}

// Called once after first sign-in to create the family + user profile rows.
export async function completeSignup(params: {
  familyName: string;
  zip: string;
  displayName: string;
  username: string;
}) {
  const { error } = await supabase.rpc("create_family_and_user", {
    _family_name: params.familyName,
    _zip: params.zip,
    _display_name: params.displayName,
    _username: params.username,
  });
  if (error) throw error;
}

// Irreversible. Calls the delete-my-account edge function which uses the
// service role to (a) drop the family if the user is the sole member,
// then (b) delete the auth.users row (cascades the public.users row).
// Required by Play Store for any app with sign-in.
export async function deleteMyAccount(): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("not signed in");

  const url = extra.supabaseUrl;
  const anonKey = extra.supabaseAnonKey;
  if (!url || !anonKey) throw new Error("missing supabase config");

  const resp = await fetch(`${url}/functions/v1/delete-my-account`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: "{}",
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body?.error ?? `delete-my-account ${resp.status}`);
  }

  // Sign out locally — the auth user is already gone server-side but the
  // local session token still exists in storage until we explicitly clear.
  await supabase.auth.signOut();
}
