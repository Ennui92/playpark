/**
 * Firebase initialisation.
 *
 * Copy this file to `firebase.ts` (which is git-ignored) and fill in your
 * project's web config from the Firebase console:
 *
 *     cp src/config/firebase.example.ts src/config/firebase.ts
 *
 * ── Local emulator + web (recommended for dev) ───────────────────────────────
 *   1. Start the emulators:   firebase emulators:start
 *   2. Run the app for web:    EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true npx expo start --web
 *   3. Seed playgrounds:       cd scripts && npm install && npm run seed:emulator
 *
 * When EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true the SDK talks to the local
 * emulator and the `firebaseConfig` below can stay as placeholder values
 * (only a non-empty projectId/apiKey is required to initialise).
 */
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const USE_EMULATOR = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

// Replace with your real web config for device/production builds.
// For emulator-only dev these can stay as-is.
const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'playpark-dev.firebaseapp.com',
  projectId: 'playpark-dev',
  storageBucket: 'playpark-dev.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

if (USE_EMULATOR) {
  // `localhost` works for web; use your machine's LAN IP for a physical device.
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST || 'localhost';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  // eslint-disable-next-line no-console
  console.log(`[firebase] Connected to local emulators at ${host}`);
}
