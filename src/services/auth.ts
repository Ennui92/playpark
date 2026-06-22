import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser,
} from "firebase/auth";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  deleteDoc,
  runTransaction,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/config/firebase";
import { setCachedFamilyId } from "@/services/me";

// ── Auth model note ─────────────────────────────────────────────────────────
// Supabase used passwordless email OTP (6-digit code). Firebase Auth has no
// email-OTP-code primitive (only email-LINK or password). To keep onboarding
// reliable and fully testable we use email + password here. The two-step
// "email then code" UI became a single email + password form. See MIGRATION.md
// — passwordless email-link is a possible future swap.

// Sign in; if the account doesn't exist yet, create it. This preserves the
// "one field, just get me in" feel of the old OTP flow.
export async function signInOrCreate(email: string, password: string) {
  const e = email.trim().toLowerCase();
  try {
    return await signInWithEmailAndPassword(auth, e, password);
  } catch (err: any) {
    const code = err?.code as string | undefined;
    // Newer Firebase returns auth/invalid-credential for both wrong-password
    // and unknown-user (email-enumeration protection). Try to create; if the
    // email already exists, it was a wrong password.
    if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
      try {
        return await createUserWithEmailAndPassword(auth, e, password);
      } catch (err2: any) {
        if (err2?.code === "auth/email-already-in-use") {
          throw new Error("That email exists but the password is wrong.");
        }
        if (err2?.code === "auth/weak-password") {
          throw new Error("Password must be at least 6 characters.");
        }
        throw err2;
      }
    }
    throw err;
  }
}

// Called once after first sign-in to create the family + user profile +
// username index, atomically. Replaces the create_family_and_user RPC.
export async function completeSignup(params: {
  familyName: string;
  zip: string;
  displayName: string;
  username: string;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("not authenticated");

  const username = params.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error("invalid username");

  const familyRef = doc(collection(db, "families"));
  const userRef = doc(db, "users", user.uid);
  const unameRef = doc(db, "usernames", username);
  const nowIso = new Date().toISOString();

  await runTransaction(db, async (tx) => {
    const unameSnap = await tx.get(unameRef);
    if (unameSnap.exists()) throw new Error("username taken");
    tx.set(familyRef, {
      name: params.familyName,
      zip: params.zip,
      avatar_url: null,
      bio: null,
      created_at: nowIso,
    });
    tx.set(userRef, {
      family_id: familyRef.id,
      display_name: params.displayName,
      username,
      push_token: null,
      created_at: nowIso,
    });
    // Public-read index: powers username search + uniqueness (Firestore has
    // no unique constraint, so the transaction enforces it).
    tx.set(unameRef, {
      uid: user.uid,
      family_id: familyRef.id,
      family_name: params.familyName,
      display_name: params.displayName,
    });
  });

  setCachedFamilyId(familyRef.id);
  return familyRef.id;
}

// Irreversible account deletion (Play Store requirement). Best-effort
// client-side cascade of the caller's own data, then deletes the auth user.
// NOTE: friend edges other families hold pointing at this family are left as
// orphans (a callable Cloud Function would clean those up — see MIGRATION.md).
export async function deleteMyAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("not signed in");

  const userSnap = await getDoc(doc(db, "users", user.uid));
  const familyId = userSnap.data()?.family_id as string | undefined;
  const username = userSnap.data()?.username as string | undefined;

  // Is this the sole member of the family?
  let soleMember = true;
  if (familyId) {
    const members = await getDocs(
      query(collection(db, "users"), where("family_id", "==", familyId))
    );
    soleMember = members.size <= 1;
  }

  if (familyId && soleMember) {
    // Delete the family's subcollections we own (best-effort).
    for (const sub of ["kids", "friends", "favorites", "mutes"]) {
      const snap = await getDocs(collection(db, "families", familyId, sub));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }
    // Active broadcasts by this family.
    const bc = await getDocs(
      query(collection(db, "broadcasts"), where("family_id", "==", familyId))
    );
    await Promise.all(bc.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, "families", familyId)).catch(() => {});
  }

  if (username) await deleteDoc(doc(db, "usernames", username)).catch(() => {});
  await deleteDoc(doc(db, "users", user.uid)).catch(() => {});

  setCachedFamilyId(null);
  // Requires a recent login; surfaces auth/requires-recent-login if stale.
  await deleteUser(user);
}
