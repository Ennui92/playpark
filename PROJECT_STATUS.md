# Outside — Project Status & Handoff

_Last updated: 2026-06-06_

A session-to-session handoff doc. Read this first when picking the project
back up.

---

## What Outside is

A mobile app for parents in Berlin: pick a landmark (playground, park, café,
library, indoor play space…) and broadcast "we're heading there" to friend
families. The other families see it in their feed and can join. Family-scoped
broadcasts, not public posts.

Built with **Expo / React Native + Supabase** (Postgres + RLS + Edge Functions
+ Realtime).

---

## Architecture (Supabase)

- **Auth** — Supabase Auth (email + dev-signin edge function for local).
- **Schema** — `supabase/migrations/0001_init.sql` and follow-ups define:
  `families`, `users`, `kids`, `landmarks`, `landmark_subs`, `broadcasts`,
  `friendships`, `qr_nonces`, plus favorites and user landmarks.
- **Realtime** — broadcasts fan out via Postgres LISTEN/NOTIFY through
  Supabase Realtime; the on-broadcast-created edge function handles push.
- **RLS** — every table is gated by family membership; a user only sees rows
  their family is allowed to see. Server-side, not client-side.
- **Landmark data** — seeded via SQL migrations (`0002_seed_landmarks.sql`,
  `0005_seed_landmarks_expanded.sql`). The `scripts/` folder has a Berlin
  Overpass fetcher to extend the seed set when needed (see scripts/README.md).
- **Google Places & Static Maps** — the app uses Google Places Autocomplete
  to let users search for landmarks (`src/services/geocoding.ts`) and Static
  Maps for previews (warm-toned style to match the cream + coral palette).
  Requires `googleMapsApiKey` in app config extras.

---

## Current state (high level)

| Area | Status |
|---|---|
| Auth (email + dev-signin) | ✅ Working |
| Onboarding (family + handle + kids) | ✅ Working |
| Landmark list, detail, favorites | ✅ Working |
| Add a landmark (search Places, or pin location) | ✅ Working — Places search just landed |
| Map preview (Static Maps with warm style) | ✅ Working |
| Broadcasts (compose, send, see feed) | ✅ Working |
| Friend families (search by handle, QR add) | ✅ Working — Copy + Share handle just landed |
| Push notifications | ✅ Wired (edge function) |
| Android EAS build workflow | ✅ Wired (`.github/workflows/build-android.yml`) |
| iOS build | ⚠️ Not yet exercised |
| Automated tests | ❌ None |

---

## How to run locally

```bash
npm install
npx supabase start           # local Supabase stack
npx supabase db push         # apply migrations
npx supabase functions deploy --local
npx expo start
```

Configure `app.json` extras with your local Supabase URL/anon key and a
Google Maps API key (Maps Static + Places New). For phone testing, use
Expo Go and the LAN URL.

---

## Building an Android APK

Push to `main` (or trigger the workflow manually) — `.github/workflows/build-android.yml`
queues an EAS preview build and posts the download link as a workflow summary
so a phone can grab it directly. Needs `EXPO_TOKEN` repo secret.

---

## Layout

```
src/
  components/        # MapPreview, PlaceAutocomplete, Button, …
  config/            # supabase client, env extras
  contexts/          # SessionContext (auth + family + user)
  data/              # berlinZips
  navigation/        # Root + Main stack
  screens/
    auth/            # sign-in, onboarding
    friends/         # QRShare, QRScan
    main/            # Feed, Landmark, AddLandmark, Friends, …
  services/          # auth, broadcasts, favorites, friends, geocoding,
                     # landmarks, push  (all flat — no firebase/ folder)
  types/             # domain types mirroring the Supabase schema
  utils/             # theme, helpers
supabase/
  functions/         # dev-signin, on_broadcast_created
  migrations/        # 0001_init → 0006_add_community_center_category
scripts/             # Overpass Berlin playground fetcher (see scripts/README.md)
legacy/              # pre-rewrite Firebase code (read-only reference)
```

---

## History note

This codebase was rewritten from Firebase to Supabase in commit
`58898ca`. The old Firebase service layer lives under `legacy/` for
reference. Anything dated before 2026-06-06 that mentions Firebase or
Firestore is pre-rewrite.
