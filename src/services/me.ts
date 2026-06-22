import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/config/firebase";

// Server-side Supabase used auth_family_id() inside RLS/RPCs to resolve the
// caller's family. Firestore rules can't run that for us cheaply, so the
// client needs the current family_id for most queries. We cache it after the
// first lookup (SessionContext primes it on profile load) to avoid a read on
// every call.
let cachedFamilyId: string | null = null;

export function setCachedFamilyId(id: string | null): void {
  cachedFamilyId = id;
}

export async function getMyFamilyId(): Promise<string> {
  if (cachedFamilyId) return cachedFamilyId;
  const u = auth.currentUser;
  if (!u) throw new Error("not signed in");
  const snap = await getDoc(doc(db, "users", u.uid));
  const fid = snap.data()?.family_id as string | undefined;
  if (!fid) throw new Error("no family");
  cachedFamilyId = fid;
  return fid;
}
