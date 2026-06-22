import "react-native-url-polyfill/auto";
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import * as fbAuth from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

// getReactNativePersistence ships in Firebase's React Native build but is
// missing from the default (web) type declarations — a long-standing typing
// gap. Resolve it through a cast; Metro picks the RN implementation at runtime.
const getReactNativePersistence = (fbAuth as any).getReactNativePersistence as (
  storage: unknown
) => any;

// ─── Firebase web config (Outside / playpark) ──────────────────────────────
// The web config is public by design — Firestore Security Rules guard the
// data, the apiKey just identifies the project. Mirrors how the old Supabase
// anon key lived in app.json.
const firebaseConfig = {
  apiKey: "AIzaSyBGzBR9oGVfHhTITB3Y0vJ7TYtETJwHCLU",
  authDomain: "outside-playpark-ermis.firebaseapp.com",
  projectId: "outside-playpark-ermis",
  storageBucket: "outside-playpark-ermis.firebasestorage.app",
  messagingSenderId: "212926758172",
  appId: "1:212926758172:web:1e056d0dab767ad0c1ced9",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// RN needs explicit AsyncStorage-backed persistence or the session is lost on
// reload. (The web SDK's default persistence doesn't exist in React Native.)
// initializeAuth must run exactly once; guard against Fast Refresh double-init.
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Already initialized (Fast Refresh) — reuse it.
  const { getAuth } = require("firebase/auth");
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

// ─── Local emulator wiring (testing) ───────────────────────────────────────
// Set EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1 to point the SDK at the local
// Firebase Emulator Suite. EXPO_PUBLIC_EMULATOR_HOST defaults to localhost
// (use your machine's LAN IP when testing on a physical device).
if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "1") {
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? "localhost";
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
  // eslint-disable-next-line no-console
  console.log(`[firebase] using emulators @ ${host}`);
}

export { app, auth, db, storage };
