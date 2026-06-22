# Outside (playpark) — Supabase → Firebase migration

Migrated the backend from Supabase (Postgres + RLS + Edge Functions) to Firebase
(Auth + Firestore + Storage + Cloud Functions). Fresh start — no user-data
migration. The public **landmark catalogue** is carried over (reference data).

Firebase project: **`outside-playpark-ermis`** (region `eur3`).

---

## What changed

| Area | Before (Supabase) | After (Firebase) |
|---|---|---|
| Client | `@supabase/supabase-js` | `firebase` JS SDK v12 |
| Config | `src/config/supabase.ts` (anon key in app.json) | `src/config/firebase.ts` (public web config) |
| Auth | passwordless email **OTP code** | **email + password** (see note) |
| DB | 11 Postgres tables + RLS | Firestore collections + security rules |
| Joins | SQL `select(...families(...),landmarks(...))` | **denormalized** fields on the broadcast doc |
| RPCs | 9 SECURITY DEFINER functions | client-side logic gated by rules |
| Push | Postgres triggers → 5 edge functions | Firestore-triggered **Cloud Functions** |
| Avatars | Supabase Storage `avatars` bucket | Firebase Storage `avatars/<familyId>.jpg` |
| Session | SecureStore adapter | AsyncStorage (`getReactNativePersistence`) |

### ⚠️ Auth UX change (needs your sign-off)
Supabase used a passwordless 6-digit email OTP. **Firebase Auth has no
email-OTP-code primitive** — only email *link* or email + password. Email-link
requires deep-link handling that can't be verified unattended/on-device, so I
moved sign-in to **email + password** (`signInOrCreate` creates the account if
it doesn't exist, preserving the "one screen, just get in" feel). The two-step
email→code screen became a single email + password form.
If you'd rather keep passwordless, I can switch to **email-link** as a follow-up.

---

## Firestore data model

```
families/{familyId}              name, zip, avatar_url, bio, created_at
  ├─ kids/{kidId}
  ├─ friends/{otherFamilyId}     edge doc {created_at} — bidirectional
  ├─ favorites/{landmarkId}
  └─ mutes/{landmarkId}
users/{uid}                      family_id, display_name, username, push_token
usernames/{username}             {uid, family_id, family_name, display_name}  (public index: search + uniqueness)
landmarks/{id}                   public catalog; created_by_family_id, place_id
friend_requests/{from_to}        id = `${from}_${to}`; from/to_family_id (+denormalized sender name/zip)
qr_nonces/{nonce}                capability token; family_id, expires_at, used_at
broadcasts/{id}                  family_id, landmark_id, planned_at, expires_at, ended_at, kid_ids,
                                 + DENORMALIZED family_name, family_avatar_url, landmark_name, landmark_emoji
  └─ rsvps/{familyId}            status, + denormalized responder family_name/avatar
```

### Why denormalize broadcasts
Firestore has no joins. The feed read every broadcast with its family + landmark
in one Supabase query; here those fields are copied onto the broadcast at write
time (`createBroadcast`). Trade-off: a family avatar/name change doesn't
retro-update old broadcasts (acceptable — broadcasts are short-lived, ≤2h).

### Friend graph without a server
The 9 RPCs were SECURITY DEFINER (privileged server writes). Reimplemented
client-side, gated by rules:
- Friendships = two edge docs `families/{a}/friends/{b}` + `families/{b}/friends/{a}`.
- A friend **edge** can only be created if a `friend_request` exists between the
  two families (`reqExists()` in rules) — you can't force-friend a stranger.
- `friend_requests` use a deterministic id `${from}_${to}` so the mutual-interest
  fast path and the rules can look them up by existence.
- QR nonces use a Firestore auto-id (strong RNG) as the capability token.

### Friend-scoped reads
Firestore rejects a query that *could* return docs you can't read, so the feed
queries `where('family_id','in', [me, ...friends])` (cap 30) instead of "all
active broadcasts" — RLS did that filter implicitly. >30 friend families would
need batching (noted; rare for this app).

---

## Security rules
`firestore.rules` ports the RLS model: own-or-friend reads for families / kids /
broadcasts / rsvps; self-only for users / favorites / mutes; public read for
landmarks + usernames; creator-only writes for landmarks; request-gated friend
edges. `storage.rules` makes avatars public-read, owner-write.
**Validated by the integration test below (rules enforced, incl. a negative
test that a non-friend is denied).**

---

## Cloud Functions (push) — deploy needs Blaze
`functions/src/index.ts` has 4 Firestore triggers replacing the Postgres
push triggers + edge functions:
`onBroadcastCreated` (notify friends minus mutes), `onBroadcastUpdated`
(notify RSVPers on change/wrap-up), `onFriendRequestCreated`, `onRsvpChanged`.
They send Expo push exactly as before.
**Cloud Functions require the Blaze (pay-as-you-go) plan.** Until billing is on,
they won't deploy and background push won't fire — but the in-app feed works
(Firestore reads). `delete-my-account` and `dev-signin` edge functions are gone:
account deletion is now client-side (`deleteMyAccount`), dev-signin is obsolete.

---

## Testing
`scripts/test-firebase.mjs` runs against the **Auth + Firestore emulators with
the real security rules**, acting as two authenticated users (mirrors
`src/services/*`). **10/10 checks pass:**

```
✓ two families created + onboarded
✓ username prefix search finds Alpha
✓ B created friend_request B->A
✓ A sees 1 pending friend request
✓ friendship edge A->B created
✓ A created landmark + broadcast
✓ B's feed includes A's broadcast (friend-scoped read)
✓ B RSVPed coming; A can read it
✓ non-friend CANNOT read the broadcast (rules enforced)
✓ A has 1 friend (count helper)
ALL 10 CHECKS PASSED ✅
```

Run it:
```
firebase emulators:exec --only auth,firestore "node scripts/test-firebase.mjs"
```

`npx tsc --noEmit` passes. Seed validated against the emulator (741 landmarks
fetched from the old Supabase project and written).
(Java for the emulator: `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`.)

---

## ✅ Human to-do (live cutover)
Nothing below was run against the live project (per the "you deploy live" plan).

1. **Enable Email/Password** sign-in: Firebase console → Auth → Sign-in method.
2. **Deploy rules + indexes:**
   ```
   firebase deploy --only firestore:rules,firestore:indexes,storage --project outside-playpark-ermis
   ```
   (The feed queries need composite indexes — `firestore.indexes.json` has them;
   if a live query still asks for one, follow the console link to add it.)
3. **Seed the live landmark catalogue:**
   ```
   GOOGLE_APPLICATION_CREDENTIALS=<service-account>.json node scripts/seed-firestore.mjs
   ```
4. **(Optional) Background push:** upgrade the project to **Blaze**, then
   `cd functions && npm install && npm run build && firebase deploy --only functions`.
5. **Native FCM:** the Android `google-services.json` still points at the old
   Firebase project (`nearme-5827e`). Download a fresh one for
   `outside-playpark-ermis` (console → Project settings → Android app
   `dev.ermis.outside`) and replace it before an EAS build.
6. **On-device smoke test** via Expo Go / a dev build.

### Known limitations (vs Supabase RLS)
- Account deletion leaves orphaned friend edges in *other* families (a callable
  Cloud Function would clean them up).
- QR-nonce "used" marking is best-effort (any signed-in user can mark one used).
- Username uniqueness is enforced by a transaction, not a DB constraint.
