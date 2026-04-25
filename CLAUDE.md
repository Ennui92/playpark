# Internal notes for future Claude sessions

This file is an internal hand-off for Claude. Read it before touching the
QR-generation or "Add Playground" code paths — it captures decisions that
aren't obvious from the diff.

---

## Branch

All work in this repo is on `claude/fix-qr-maps-location-LUa3e`. Push there.

## Recent change set (session of 2026-04-25)

### 1. QR code generation no longer depends on a deployed Cloud Function

**Problem reported:** "the generate QR code doesn't work."
**Root cause:** `AddFriendScreen` called `generateQRNonce()` (a Firebase
callable function) and had no `.catch` → if Functions weren't deployed or
the call errored, the spinner ran forever.

**Fix:**
- `src/services/firebase/friendService.ts` now writes the nonce directly
  to Firestore from the client. No Cloud Function call on the generation
  path. Validation/consumption still happens server-side in the
  `sendFriendRequest` callable (which uses the Admin SDK and bypasses
  rules).
- `firestore.rules` updated: `match /qrNonces/{nonceId}` now allows
  `create` if `request.resource.data.userId == request.auth.uid` and
  `used == false`. Read/update/delete still denied to clients.
- `src/screens/main/AddFriendScreen.tsx` got an error state + retry
  button so a failed write doesn't hang the screen.
- `functions/src/index.ts` still has the legacy `generateQRNonce`
  callable. Left in place — harmless, and old clients (if any) keep
  working. Safe to delete in a future cleanup.

**You must deploy `firestore.rules` for QR generation to work** —
otherwise client writes to `qrNonces` will be rejected. Tell the user:
`firebase deploy --only firestore:rules`.

### 2. "Add a playground" now resolves a real address (not just coords)

**Problem reported:** "adding my position from maps to a new place only
pulls coordinates not Google maps location even though I gave you the
API key last time."
**Root cause:** `createPlayground` had `address: \`${lat}, ${lng}\``
hardcoded, AND there was no UI calling it (the user's earlier "Add Place"
screen wasn't in the repo on this branch — first commit only).

**Fix:**
- New `src/utils/places.ts` exposes `resolvePlace(lat, lng)`:
  1. If `Constants.expoConfig.extra.googleMapsApiKey` is set (and not
     the literal `"YOUR_GOOGLE_MAPS_API_KEY"`), tries Google **Places
     Nearby Search** (`type=park`, radius 80m) for a real place name,
     then **Geocoding API** for the address.
  2. Falls back to `expo-location`'s `reverseGeocodeAsync` (uses the OS
     geocoder, no key required).
  3. Last-resort: returns the formatted coordinates.
- New screen `src/screens/main/AddPlaygroundScreen.tsx` does the GPS +
  resolve flow, lets the user edit name/address, and calls
  `createPlayground`.
- `src/services/firebase/checkInService.ts` — `createPlayground` now
  takes a single params object including `address` and `googlePlaceId`.
- Wired into `CheckInStackParamList` (`AddPlayground`) and
  `MainNavigator`. There's a dashed-border "Add a playground" footer
  button on `CheckInScreen` (visible after the nearby list, also when
  empty) that navigates to it.
- Added `expo-constants` to `package.json` (it was only a transitive
  dep before).

**Where the API key goes:** `app.json` → `expo.extra.googleMapsApiKey`.
The placeholder string `"YOUR_GOOGLE_MAPS_API_KEY"` is intentionally
treated as "no key set" by `places.ts`, so leaving the placeholder
gracefully falls through to the OS geocoder. The user has previously
mentioned giving an API key in an earlier session — that key was lost
because there is only one commit on `main` (initial commit). If the
user provides it again, replace the placeholder and commit.

### 3. APK build via GitHub Actions

`.github/workflows/build-android.yml` + `eas.json` build an internal
preview APK via EAS and write the artifact URL into the workflow
summary. Triggers: push to `main` or `claude/fix-qr-maps-location-LUa3e`,
or manual `workflow_dispatch`.

**Blockers the user must clear** (we can't do these from inside Claude):
1. Repo secret `EXPO_TOKEN` (https://expo.dev/settings/access-tokens).
2. `app.json` → `expo.extra.eas.projectId` is still
   `"YOUR_EAS_PROJECT_ID"`. The user's existing project is at
   `expo.dev/accounts/albertcamus/projects/outside` — they need to put
   that project's ID here, OR run `eas init` locally to relink.

The workflow uses `--profile preview` which is set to
`android.buildType: "apk"` in `eas.json` (NOT app-bundle), so the
artifact is a directly installable APK.

## Things to be careful about

- `firestore.rules` and `functions/` are deploy-gated. Code changes here
  don't take effect until the user runs `firebase deploy`. Always tell
  them which deploy command to run after a change.
- `src/config/firebase.ts`, `google-services.json`, and
  `GoogleService-Info.plist` are gitignored. Don't try to read or
  generate them from inside Claude — they contain the user's real
  Firebase credentials.
- The user is on mobile and primarily wants installable artifacts. If
  they ask for a build, the right answer is "push, then point them at
  the GitHub Actions run summary" — don't try to run `eas build` from
  inside this environment, it won't work.
- The user's Expo account is `albertcamus`, project slug `outside`
  (despite `app.json` saying slug `playpark` — the slug there hasn't
  been reconciled).

## Open follow-ups (not done this session)

- Replace `app.json` placeholders (`googleMapsApiKey`, `eas.projectId`)
  with real values once the user provides them.
- Reconcile the `playpark` vs `outside` slug mismatch.
- Once `firestore.rules` is deployed, consider deleting the now-unused
  `generateQRNonce` callable in `functions/src/index.ts`.
