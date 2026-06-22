import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/config/firebase";
import { AppUser, Family } from "@/types";
import { registerForPushNotifications } from "@/services/push";
import { getPendingRequestCount } from "@/services/friends";
import { setCachedFamilyId } from "@/services/me";

// Three states the app cares about:
//   1. loading     — initial auth check in flight
//   2. signed out  — no session
//   3. signed in, onboarded=false  — has auth but no user/family doc yet
//   4. signed in, onboarded=true   — full profile available
//
// The navigator branches on these. `session` is the Firebase User.

interface SessionContextValue {
  session: User | null;
  user: AppUser | null;
  family: Family | null;
  loading: boolean;
  initError: boolean;
  retryInit: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  pendingRequestCount: number;
  refreshBadges: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  async function loadProfile(authUserId: string) {
    // IMPORTANT: surface errors (don't swallow). A thrown error here means a
    // network/db failure (→ initError), distinct from a missing doc (a genuine
    // new user who needs onboarding).
    const userSnap = await getDoc(doc(db, "users", authUserId));

    if (!userSnap.exists()) {
      setUser(null);
      setFamily(null);
      setCachedFamilyId(null);
      setPendingRequestCount(0);
      return;
    }

    const userRow = { id: userSnap.id, ...(userSnap.data() as Omit<AppUser, "id">) };
    const famSnap = await getDoc(doc(db, "families", userRow.family_id));

    setUser(userRow);
    setFamily(famSnap.exists() ? { id: famSnap.id, ...(famSnap.data() as Omit<Family, "id">) } : null);
    setCachedFamilyId(userRow.family_id);

    // Fire-and-forget push registration. Failures are logged, not blocking.
    registerForPushNotifications(userRow.id).catch((e) => {
      console.warn("[push] auto-register failed:", e?.message ?? e);
    });

    getPendingRequestCount(userRow.family_id).then(setPendingRequestCount).catch(() => {});
  }

  function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("boot timeout")), ms)
      ),
    ]);
  }

  // Boot is driven by the onAuthStateChanged listener below (Firebase restores
  // the persisted session asynchronously). retryInit re-runs the profile load.
  const bootstrap = useCallback(async () => {
    const BOOT_TIMEOUT_MS = 8000;
    setInitError(false);
    try {
      if (auth.currentUser) {
        await withTimeout(loadProfile(auth.currentUser.uid), BOOT_TIMEOUT_MS);
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
      setPendingRequestCount(await getPendingRequestCount(family.id));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let mounted = true;

    // Last-resort safety net: never leave the splash spinner up forever.
    const safety = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 10000);

    const unsub = onAuthStateChanged(auth, async (u) => {
      setSession(u);
      if (u) {
        setInitError(false);
        try {
          await loadProfile(u.uid);
        } catch (e: any) {
          console.warn("[session] profile load failed:", e?.message ?? e);
          setInitError(true);
        }
      } else {
        setUser(null);
        setFamily(null);
        setCachedFamilyId(null);
        setPendingRequestCount(0);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safety);
      unsub();
    };
  }, []);

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
        if (session) await loadProfile(session.uid);
      },
      refreshBadges: refreshBadgesInternal,
      signOut: async () => {
        await fbSignOut(auth);
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
