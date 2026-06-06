# Outside — scripts

Dev/ops helpers. Plain Node (v18+), separate from the Expo app.

```bash
cd scripts
npm install
```

## Berlin landmark data

Three things live here:

- **`berlin-playgrounds.json`** — ~30 curated, real, named Berlin playgrounds.
  Hand-checked. No network needed. Kept around as a portable JSON snapshot.
- **`fetch-berlin-playgrounds.mjs`** — pulls the full playground set (~2,500)
  from OpenStreetMap (Overpass) and writes
  `berlin-playgrounds.generated.json`. Same `{name, address, lat, lng}`
  shape as the curated file. Useful for ad-hoc inspection.

  ```bash
  npm run fetch:berlin
  ```

- **`build-osm-migration.mjs`** — the real workhorse. Pulls Berlin
  playgrounds + parks from Overpass, resolves ZIPs via Berlin's
  `boundary=postal_code` polygons (point-in-polygon), dedupes against
  the curated seed rows in `0002` + `0005`, applies quality filters
  (drops nudist areas, bare-generic names, OSM-mis-tagged squares),
  and writes a ready-to-apply migration at
  `../supabase/migrations/0007_seed_landmarks_osm.sql`.

  ```bash
  npm run build:osm-migration
  cd ..
  npx supabase db push   # apply on the live project
  ```

  Re-run whenever the curated seed expands — it'll dedupe correctly.

Data © OpenStreetMap contributors, ODbL.
