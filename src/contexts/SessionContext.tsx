import React, {
  createContext,
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
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  async function loadProfile(authUserId: string) {
    const { data: userRow } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUserId)
      .maybeSingle();

    if (!userRow) {
      setUser(null);
      setFamily(null);
      setPendingRequestCount(0);
      return;
    }
    setUser(userRow as AppUser);

    // Fire-and-forget push registration. Failures are logged but don't
    // block sign-in — the MeScreen "Test push setup" button lets the
    // user re-run and see the actual error if pushes aren't arriving.
    registerForPushNotifications((userRow as AppUser).id).catch((e) => {
      console.warn("[push] auto-register failed:", e?.message ?? e);
    });

    const { data: familyRow } = await supabase
      .from("families")
      .select("*")
      .eq("id", (userRow as AppUser).family_id)
      .maybeSingle();

    setFamily((familyRow as Family) ?? null);

    // Initial badge count.
    if (familyRow) {
      getPendingRequestCount((familyRow as Family).id)
        .then(setPendingRequestCount)
        .catch(() => {});
    }
  }

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

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s?.user) {
        await loadProfile(s.user.id);
      } else {
        setUser(null);
        setFamily(null);
        setPendingRequestCount(0);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      user,
      family,
      loading,
      pendingRequestCount,
      refreshProfile: async () => {
        if (session?.user) await loadProfile(session.user.id);
      },
      refreshBadges: refreshBadgesInternal,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, user, family, loading, pendingRequestCount]
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
