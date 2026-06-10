# Outside — Google Play submission checklist

Everything needed to publish, in order. Items marked **[me]** I (Claude) have
already prepared in the repo; **[you]** are steps only you can do in Play
Console or on your phone. Work top to bottom.

---

## 0. One thing to do BEFORE you publish — close the dev backdoor  [you]
The magic sign-in code `123456` is still active in production. It must be off
before real users arrive, or anyone can sign in as any email.

Run this (unsets the env var on Supabase, then redeploy isn't needed — the
function reads it live):
```
npx supabase secrets unset ALLOW_DEV_SIGNIN --project-ref vqwzyrydhsourpkjdmot
```
After this, only the real email-code flow works. **Verify the real OTP email
actually arrives** (it may hit spam — if so, set up custom SMTP later via
Resend). Keep it ON only while you still need backdoor testing.

---

## 1. The app bundle (AAB)  [me → you upload]
- A production **.aab** is built by the "Build Android AAB (production)"
  GitHub Action and attached to a GitHub Release tagged `prod-N`.
- Download `outside.aab` from the latest `prod-*` release.
- Play Console → **Test and release → Production** (or Closed/Open testing
  first) → **Create new release** → drop in the `.aab`.
- It already contains FCM push, EN/DE, profiles, RSVPs, friend requests, and
  all the bug fixes.

## 2. Store listing  [me → you paste]
- Copy from `play-assets/STORE_LISTING.md` (English + German).
- App name, short + full description for each language.

## 3. Graphics  [me has 2, you do screenshots]
- App icon 512×512 → `play-assets/icon-512.png` ✅
- Feature graphic 1024×500 → `play-assets/feature-graphic.png` ✅
- **Phone screenshots (2–8)** → you capture on your phone. Suggested shots:
  1. Home with the dynamic hero ("2 friends are out right now")
  2. A landmark with the map + "Who's headed here" + RSVP buttons
  3. The broadcast compose screen (time chips)
  4. Add-a-place with the Google Places search + map pin
  5. Friends tab (your handle + a friend or two)
  6. A profile with avatar + bio
  Take them on a real device (Power+VolDown). Min 320px, ratio 9:16. Optionally
  add the German UI for a couple to show localisation.

## 4. Privacy policy  [me]
- URL: `https://ennui92.github.io/playpark/privacy.html` (live)
- Paste into Play Console → **App content → Privacy policy**.

## 5. Data safety form  [you, answers from me]
- Fill using `play-assets/PLAY_DATA_SAFETY.md` — every answer is pre-written.

## 6. Content rating questionnaire  [you, answers below]
Play Console → **App content → Content ratings**. Expected outcome with these
answers: roughly **Teen / PEGI 12** (driven by user interaction + location
sharing + user-generated content — standard for a social app).

Answer the IARC questionnaire as:
- **Category:** Social Networking / Communication
- Violence, sexual content, profanity, controlled substances, gambling, scary
  content → **No / None** for all.
- **Does the app allow users to interact or communicate?** → **Yes**
  (broadcasts, friend requests, RSVPs)
- **Can users share their location with others?** → **Yes**
  (broadcasts reveal the place you're heading to)
- **Does the app contain user-generated content?** → **Yes** (places, bios,
  broadcasts)
- **Is there a way to report/moderate UGC?** → **Yes** (report via email; we
  remove content/accounts per the Terms)

## 7. App content declarations  [you]
- **Target audience & content:** select **18+** (or 13+) — NOT "designed for
  children." Outside is for adults; kid details are entered by adults.
- **Ads:** **No ads.**
- **News app:** No.
- **COVID-19 / government:** No.
- **Data deletion:** in-app + email (already covered by privacy policy + the
  Delete account button).

## 8. App access  [you]
- Play review needs to use the app. Either:
  - Provide reviewer test credentials (an email + tell them the OTP flow), OR
  - Temporarily note that sign-in is by emailed code. Since there's no
    password, give a reviewer a working email they can receive the code on,
    OR (simplest) re-enable `ALLOW_DEV_SIGNIN` with code `123456` for the
    review and give the reviewer that note, then unset it after approval.
  - Recommended: in **App access**, add an instruction: "Sign in with any
    email, then enter the code we email you. Test code 123456 also works."
    and keep ALLOW_DEV_SIGNIN on through review, then turn it off.

## 9. Pricing & distribution  [you]
- Free.
- Pick countries (at minimum Germany; add others if you like).
- Confirm it complies with US export laws, no ads declaration, content
  guidelines.

## 10. Submit  [you]
- Roll out to **Internal testing** first (instant, invite-only), confirm the
  whole flow on a fresh install from Play, then promote to **Production**
  (review takes hours–days for a new app + first-time developer checks).

---

## Pages live on GitHub Pages
- Landing: https://ennui92.github.io/playpark/
- Privacy: https://ennui92.github.io/playpark/privacy.html
- Terms: https://ennui92.github.io/playpark/terms.html
- Support: https://ennui92.github.io/playpark/support.html

## Still optional / nice-to-have (won't block submission)
- German for the QR-scan + change-neighbourhood screens (still English).
- Crash reporting (Sentry) — you already use it on PodReddit; ~30 min.
- Custom SMTP (Resend) so the real OTP email doesn't land in spam.
- A proper designed icon (current one is a clean coral "o" placeholder).
