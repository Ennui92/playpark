# Testing PlayPark locally

The fastest way to click around the app with **no real Firebase project, no
app-store build, and no credentials** is the Firebase Emulator Suite + Expo web.

## 1. Install

```bash
npm install                 # app deps
cd functions && npm install && cd ..
cd scripts  && npm install && cd ..
npm install -g firebase-tools   # if you don't have it
```

## 2. Configure Firebase for the emulator

```bash
cp src/config/firebase.example.ts src/config/firebase.ts
```

The example config already points at the local emulators when
`EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true` and works with placeholder
credentials — no edits needed for local dev.

## 3. Start the emulators

```bash
firebase emulators:start
```

Emulator UI: http://localhost:4000 (Auth 9099, Firestore 8080, Functions 5001).

## 4. Seed Berlin playgrounds

In a second terminal:

```bash
cd scripts
npm run seed:emulator        # ~30 curated Berlin playgrounds
# or, for the full live set first:  npm run fetch:berlin
```

See `scripts/README.md` for the live OpenStreetMap fetch.

## 5. Run the app (web)

```bash
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true npx expo start --web
```

You'll see `[firebase] Connected to local emulators` in the console.

> Web geolocation will ask for browser permission and report your *real*
> location. To see the seeded Berlin playgrounds, either test from Berlin or
> use your browser devtools **Sensors → Location** to spoof coordinates
> (e.g. `52.53, 13.40`). Or just use the **＋ Add** button on the Check-in
> screen to drop a playground at your current location.

## What to try

- **Sign up** (the emulator accepts any email/password).
- **Profile → My Children**: add a child.
- **Check in** (centre tab): pick a nearby Berlin playground → choose kids /
  status → check in.
- **＋ Add**: add a playground that isn't listed — it saves at your current
  location and drops you straight into checking in there.
- **Feed**: create a second account, friend it, and watch check-ins fan out.

## Physical device instead of web

Run `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true EXPO_PUBLIC_EMULATOR_HOST=<your-LAN-IP> npx expo start`
and open it in Expo Go. The device must reach your computer's IP, and the
emulator must be started with `firebase emulators:start --host 0.0.0.0`.
