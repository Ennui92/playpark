import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import { AppUser, Family } from "@/types";
import { registerForPushNotifications } from "@/services/push";
import { getPendingRequestCount } from "@/services/friends";

// Three states the app cares about:
//   1. loading     — initial session check in flight
//   2. signed out  — no session
//   3. signed in, onboarded=false  — has auth but no family row yet
//   4. signed in, onboarded=true   — full profile available
//
// The navigator branches on these.

interface SessionContextValue {
  session: Session | null;
  user: AppUser | null;
  family: Family | null;
  loading: boolean;
  // True when booting found a session but the profile fetch failed (network)
  // — distinct from "no profile yet" (a genuine new user). Lets the UI show a
  // Retry instead of hanging or wrongly sending an onboarded user to signup.
  initError: boolean;
  retryInit: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  // Badge counts surfaced on the bottom tabs. Refreshed when:
  //   - app boots / loads profile
  //   - we receive a push (handled in RootNavigator)
  //   - any screen calls refreshBadges() after a write
  pendingRequestCount: number;
  refreshBadges: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  async function loadProfile(authUserId: string) {
    // IMPORTANT: surface errors (don't swallow). A thrown error here means
    // a *network/db failure*, which the caller treats as initError — NOT the
    // same as a missing row (a genuine new user who needs onboarding).
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUserId)
      .maybeSingle();
    if (userErr) throw userErr;

    if (!userRow) {
      setUser(null);
      setFamily(null);
      setPendingRequestCount(0);
      return;
    }

    const { data: familyRow, error: famErr } = await supabase
      .from("families")
      .select("*")
      .eq("id", (userRow as AppUser).family_id)
      .maybeSingle();
    if (famErr) throw famErr;

    // Commit user + family together so we never render a half-loaded
    // profile (user set but family null → blank Home).
    setUser(userRow as AppUser);
    setFamily((familyRow as Family) ?? null);

    // Fire-and-forget push registration. Failures are logged but don't
    // block sign-in — the MeScreen "Test push setup" button lets the
    // user re-run and see the actual error if pushes aren't arriving.
    registerForPushNotifications((userRow as AppUser).id).catch((e) => {
      console.warn("[push] auto-register failed:", e?.message ?? e);
    });

    // Initial badge count.
    if (familyRow) {
      getPendingRequestCount((familyRow as Family).id)
        .then(setPendingRequestCount)
        .catch(() => {});
    }
  }

  // Bound a promise so the splash can't wait the full 30s request timeout.
  function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("boot timeout")), ms)
      ),
    ]);
  }

  // Boot: read the session and load the profile. Always resolves `loading`
  // (try/finally) so the splash spinner can never hang. On failure it sets
  // initError so the UI can offer a Retry.
  const bootstrap = useCallback(async () => {
    const BOOT_TIMEOUT_MS = 8000;
    setInitError(false);
    try {
      const { data } = await withTimeout(supabase.auth.getSession(), BOOT_TIMEOUT_MS);
      setSession(data.session);
      if (data.session?.user) {
        await withTimeout(loadProfile(data.session.user.id), BOOT_TIMEOUT_MS);
      }
    } catch (e: any) {
      console.warn("[session] init failed:", e?.message ?? e);
      setInitError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const retryInit = useCallback(() => {
    setLoading(true);
    bootstrap();
  }, [bootstrap]);

  async function refreshBadgesInternal() {
    if (!family) return;
    try {
      const n = await getPendingRequestCount(family.id);
      setPendingRequestCount(n);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let mounted = true;

    bootstrap();

    // Last-resort safety net: even if something above never settles, never
    // leave the splash spinner up for more than ~10s.
    const safety = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 10000);

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s?.user) {
        try {
          await loadProfile(s.user.id);
        } catch (e: any) {
          console.warn("[session] profile refresh failed:", e?.message ?? e);
        }
      } else {
        setUser(null);
        setFamily(null);
        setPendingRequestCount(0);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safety);
      sub.subscription.unsubscribe();
    };
  }, [bootstrap]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      user,
      family,
      loading,
      initError,
      retryInit,
      pendingRequestCount,
      refreshProfile: async () => {
        if (session?.user) await loadProfile(session.user.id);
      },
      refreshBadges: refreshBadgesInternal,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, user, family, loading, initError, retryInit, pendingRequestCount]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
