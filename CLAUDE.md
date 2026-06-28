# CLAUDE.md — Outside (playpark)

> ## ⚠️ BACKEND IS FIREBASE NOW (migrated off Supabase, June 2026)
> This app no longer uses Supabase. It runs on **Firebase** — Auth + Firestore + Storage,
> with push fan-out as Cloud Functions. Firebase project: **`outside-playpark-ermis`**.
> Any Supabase reference in `supabase/` (kept for historical schema reference), git history,
> or a previous session's memory is **historical** — do not act on it and do not reinstall
> `@supabase/supabase-js`. Full mapping in **`MIGRATION.md`** (tables→collections, RLS→rules,
> the 9 RPCs→client logic, push triggers→Cloud Functions). Read it before touching the data layer.

## What this is
"Outside" — a **family** broadcasts "we're going to LANDMARK at TIME"; friend families get a
ping and can RSVP. Identity is **family-level** (parents remember "the Chen family", not names).
Expo / React Native, TypeScript. Android package `dev.ermis.outside` (still ships to Play Store).

## Firebase layout (post-migration)
- Init: `src/config/firebase.ts` (exports `auth`, `db`, `storage`; emulator-gated by `EXPO_PUBLIC_USE_FIREBASE_EMULATOR`). Public web config lives here (tracked — it's not secret).
- Services (all Firestore now): `src/services/{auth,broadcasts,friends,landmarks,favorites,profile,push,me}.ts`.
- `src/services/me.ts` caches the caller's `family_id` (Supabase's `auth_family_id()` had no client equivalent).
- Collections: `families/{id}` (+ subcollections `kids`, `friends`, `favorites`, `mutes`), `users/{uid}`,
  `usernames/{name}` (public index), `landmarks/{id}` (public catalog), `friend_requests/{from_to}`,
  `qr_nonces/{nonce}`, `broadcasts/{id}` (+ `rsvps/{familyId}` subcollection, denormalized family/landmark fields).
- Rules: `firestore.rules` (friend-scoped reads, request-gated friend edges) + `storage.rules`. Indexes: `firestore.indexes.json`.
- Cloud Functions: `functions/` (Expo push fan-out via Firestore triggers) — **needs the Blaze plan to deploy**.
- Scripts: `scripts/seed-firestore.mjs` (landmark catalogue), `scripts/test-firebase.mjs` (emulator integration test, 10/10).

## Auth note (changed UX)
Supabase used passwordless **email OTP**. Firebase has no email-OTP primitive, so sign-in is now
**email + password** (`signInOrCreate`) **+ Google** (`signInWithGoogle`, `@react-native-google-signin`).
A brand-new user lands on Onboarding to create their family.

## Status — migration COMPLETE and live (last updated June 2026)
The Supabase→Firebase migration is **DONE and shipping in production.** This is NOT
work-in-progress — do not treat the repo as mid-migration. Many features have shipped on top.
- Firestore rules+indexes + Storage rules **deployed live**; **741 landmarks seeded**.
- Auth providers enabled: Email/Password + Google.
- Android preview APKs built via EAS (signed with a local keystore `preview.jks` — gitignored — whose
  SHA-1 is registered in the Firebase Android app, so Google sign-in works on the build).
- **Branch `firebase-migration` is the current source of truth and is PUSHED to origin.** All session
  work lives there. `main` still holds the OLD pre-migration Supabase code — merging to `main` is
  optional (CI fires only on `main`: `ota-update.yml` publishes the JS bundle to the preview +
  production channels, and `build-android.yml` runs a preview APK build).
- **Shipped on top of the migration (all via OTA `eas update`, runtime 0.2.0):** family-member
  avatars are now **DiceBear "adventurer" illustrated SVGs** with selectable skin tone + hair colour
  (emoji couldn't do diverse kids) — see `src/services/avatar.ts` + `src/components/MemberAvatar.tsx`;
  family roster (`members` subcollection); private per-friend notes; emoji reactions on outings;
  in-app feedback (`feedback` collection); places-history timeline; resilient Home feed loader.
  `react-native-svg` was already a dep, so the SVG avatars shipped over the air (no rebuild).
- Cloud Functions (push) NOT deployed yet — needs Blaze. Until then in-app feed works via Firestore; background push doesn't fire.
- `google-services.json` (tracked) points at `outside-playpark-ermis` (was the dead `nearme-5827e`).

## Conventions
Match existing code style. Don't reintroduce Supabase. Keep service function signatures stable.
The friend graph runs client-side gated by rules — preserve the "a friend edge requires a prior
friend_request" invariant in any rules change.
