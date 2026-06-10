# Google Play — Data Safety form answers

Play Console → **App content → Data safety**. This is a guided questionnaire;
below are the answers that match what Outside actually does (verified against
the code and Supabase schema). Update if the app's behaviour changes.

## Top-level
- **Does your app collect or share any of the required user data types?** → **Yes**
- **Is all user data encrypted in transit?** → **Yes** (HTTPS/TLS to Supabase, Expo, Google)
- **Do you provide a way for users to request data deletion?** → **Yes**
  - In-app: Me → Delete account. Also by email.
  - Deletion URL (if asked): https://ennui92.github.io/playpark/privacy.html

## Data types collected

For each: **Collected = Yes**, **Shared = No** unless noted. None is used for
advertising or sold. Mark "Required" vs "Optional" as noted.

| Data type | Collected | Shared | Purpose(s) | Required? |
|---|---|---|---|---|
| **Email address** | Yes | No | Account management, app functionality | Required |
| **Name** (display/group name) | Yes | No | App functionality | Required |
| **User IDs** (username) | Yes | No | App functionality | Required |
| **Approximate location** | Yes | Yes → Google Maps | App functionality (set & show place pins) | Optional |
| **Precise location** | Yes | Yes → Google Maps | App functionality ("use my location" pin) | Optional |
| **Photos** (profile avatar) | Yes | No | App functionality | Optional |
| **Other user-generated content** (broadcasts, places, bios, kid first names/ages) | Yes | No | App functionality | Optional |
| **Device or other IDs** (push token) | Yes | Yes → Google FCM / Expo | App functionality, messaging (push notifications) | Optional |

### Notes for the reviewer / form nuances
- **Location** is only accessed on explicit user action ("use my location")
  or when the in-app map is shown — never in the background. Declare it under
  app functionality, not analytics/ads.
- **Sharing** with Google (Maps SDK, FCM) and Expo (push relay) is processing
  by service providers, not sale. Play still wants these flagged as "shared"
  because data leaves your servers.
- **Kid data**: first name + birth year/month, entered by the adult account
  holder, used only to label "who's coming." Treat as user-generated content.
- No analytics SDK, no advertising ID, no third-party trackers are included.

## Security practices
- Data encrypted in transit: **Yes**
- Users can request deletion: **Yes** (in-app + email)
- Committed to Play Families Policy: only if you opt into a Families program
  (not required; Outside targets adults — set target age 18+ or 13+/Teen, not
  "designed for children").
