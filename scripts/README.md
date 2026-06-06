# Outside — scripts

Dev/ops helpers. Plain Node (v18+), separate from the Expo app.

```bash
cd scripts
npm install
```

## Berlin playground data

Two sources live here, both shaped as `{ name, address, lat, lng }`:

- **`berlin-playgrounds.json`** — ~30 curated, real, named Berlin playgrounds.
  No network needed. Useful as a hand-checked seed.
- **`fetch-berlin-playgrounds.mjs`** — pulls the full live set (~2,500+) from
  OpenStreetMap via the Overpass API (`leisure=playground`) and writes
  `berlin-playgrounds.generated.json`. Needs outbound access to
  `overpass-api.de`. Data © OpenStreetMap contributors (ODbL).

  ```bash
  npm run fetch:berlin
  ```

## Loading into Supabase

Landmarks live in the `landmarks` table (see `supabase/migrations/0001_init.sql`).
The seed migrations (`0002_seed_landmarks.sql`, `0005_seed_landmarks_expanded.sql`)
are the source of truth for what's in production. To extend them with the
data from this folder, convert the JSON rows into a new migration (one INSERT
per row, with a category, emoji, and ZIP) and apply it with `supabase db push`.

Direct emulator seeding from these files is intentionally not wired — keeping
data changes as migrations makes them reviewable and reproducible across
environments.
