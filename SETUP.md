# PlayPark — Setup Guide

## Prerequisites

- Node.js 20+
- Expo CLI: `npm install -g expo-cli eas-cli`
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (free Spark plan works for development)
- Xcode (for iOS simulator) or Android Studio (for Android emulator)

---

## 1. Firebase Project Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a project called **playpark**
3. Enable the following services:
   - **Authentication** → Sign-in methods: Email/Password, Google, Apple
   - **Firestore Database** → Start in production mode, pick a region
   - **Storage** → Start with default rules
   - **Cloud Messaging** (automatic)

4. Add an **iOS app**:
   - Bundle ID: `com.yourcompany.playpark`
   - Download `GoogleService-Info.plist` → place it in the project root

5. Add an **Android app**:
   - Package: `com.yourcompany.playpark`
   - Download `google-services.json` → place it in the project root

6. Add a **Web app** (for the JS Firebase SDK):
   - Copy the `firebaseConfig` object into `src/config/firebase.ts`

---

## 2. Install Dependencies

```bash
# App dependencies
npm install

# Cloud Functions dependencies
cd functions && npm install && cd ..
```

---

## 3. Deploy Firestore Rules and Indexes

```bash
firebase login
firebase use --add   # select your project

firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

---

## 4. Deploy Cloud Functions

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

> **Note:** The Scheduled function (`expireCheckIns`) requires the **Blaze (pay-as-you-go)** plan.
> For development, comment it out and run expiry manually via the emulator.

---

## 5. Run the App

```bash
# Start Expo development server
npx expo start

# Press 'i' for iOS simulator, 'a' for Android emulator
# Or scan the QR code with the Expo Go app on your phone
```

---

## 6. Google Maps Setup (for playground search)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable:
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
   - **Places API**
   - **Geocoding API**
3. Create an API key, restrict it to your bundle ID / package name
4. Set the key in `app.json` under `expo.extra.googleMapsApiKey`
   (read by `src/utils/places.ts` for reverse-geocoding new playgrounds —
   falls back to the OS-native geocoder if no key is set).
5. For native map tiles, also add it under
   `expo.android.config.googleMaps.apiKey` and `expo.ios.config.googleMapsApiKey`.

---

## 6a. Build an APK via GitHub Actions

The repo ships with `.github/workflows/build-android.yml`, which builds an
installable APK with EAS and posts the download link to the workflow summary.

1. Update `expo.extra.eas.projectId` in `app.json` with your real EAS project ID
   (run `eas init` locally once if you don't have one).
2. Create an Expo access token at
   [expo.dev → Settings → Access Tokens](https://expo.dev/settings/access-tokens).
3. In the GitHub repo, add a secret named **`EXPO_TOKEN`** with that token.
4. Push to `main` (or run the workflow manually from the Actions tab). The
   "APK ready" summary contains the direct download link — tap it on your
   phone to install.

---

## 7. Apple Sign-In (required for App Store)

Follow [Firebase's Apple Sign-In guide](https://firebase.google.com/docs/auth/ios/apple) to:
- Create a Services ID in Apple Developer Console
- Configure the associated domain
- Add the Auth key to Firebase Console

---

## Project Structure

```
playpark/
├── App.tsx                        ← Entry point
├── src/
│   ├── config/firebase.ts         ← Firebase init (git-ignored)
│   ├── contexts/AuthContext.tsx   ← Auth state
│   ├── navigation/                ← All navigators
│   ├── screens/
│   │   ├── auth/                  ← Welcome, Login, SignUp
│   │   └── main/                  ← Feed, CheckIn, Friends, Profile, ...
│   ├── services/firebase/         ← Firestore + Functions calls
│   ├── hooks/                     ← Custom React hooks
│   ├── components/                ← Shared UI (FeedCard, etc.)
│   ├── types/index.ts             ← All TypeScript types
│   └── utils/                     ← theme.ts, helpers.ts
├── functions/src/index.ts         ← Cloud Functions (6 functions)
├── firestore.rules                ← Security rules
├── storage.rules
└── firebase.json
```

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Fan-out feed pattern | Firestore `in` queries max at 30; fan-out scales to 500+ friends |
| QR nonces | Single-use, 24h expiry prevents replay attacks from screenshots |
| Cloud Functions handle friendships | Ensures atomicity across both users' subcollections |
| Notifications muted per-day | Core UX ask: easy "not today" without full disable |
| 6-hour check-in expiry | Prevents stale "at park" statuses if user forgets to check out |
