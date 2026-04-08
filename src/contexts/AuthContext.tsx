import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { User } from '@/types';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  appUser: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        await loadAppUser(fbUser.uid);
      } else {
        setAppUser(null);
      }

      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  async function loadAppUser(uid: string) {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      setAppUser({ uid, ...snap.data() } as User);
    } else {
      // First sign-in: create user document
      const newUser: Omit<User, 'uid'> = {
        displayName: auth.currentUser?.displayName ?? 'Parent',
        avatarUrl: auth.currentUser?.photoURL ?? null,
        createdAt: serverTimestamp() as any,
        fcmToken: null,
        notificationPrefs: {
          enabled: true,
          mutedUntil: null,
        },
        friendCount: 0,
      };
      await setDoc(ref, newUser);
      setAppUser({ uid, ...newUser } as User);
    }
  }

  async function refreshAppUser() {
    if (firebaseUser) {
      await loadAppUser(firebaseUser.uid);
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setAppUser(null);
    setFirebaseUser(null);
  }

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, isLoading, signOut, refreshAppUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
