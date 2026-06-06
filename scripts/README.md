# PlayPark scripts

Dev/ops helpers. These run with plain Node (v18+), separate from the Expo app.

```bash
cd scripts
npm install
```

## Seed playgrounds

Populate the `playgrounds` collection so the Check-in screen has real data.

### Into the local emulator (recommended)

```bash
# terminal 1 — from the repo root
firebase emulators:start

# terminal 2 — from scripts/
npm run seed:emulator
```

By default this seeds the **bundled curated set** of ~30 well-known Berlin
playgrounds (`berlin-playgrounds.json`) — no network needed.

### Fetch the full, live Berlin dataset from OpenStreetMap

```bash
npm run fetch:berlin     # writes berlin-playgrounds.generated.json (~2,500 playgrounds)
npm run seed:emulator    # seeds the generated file if present, else the curated set
```

Requires outbound access to `overpass-api.de`. Data © OpenStreetMap
contributors (ODbL).

### Into a real Firebase project

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
export FIREBASE_PROJECT_ID=your-project-id
npm run seed
```

## Notes

- The seeder is **idempotent** — doc IDs are derived from name + rounded
  coordinates, so re-running updates rather than duplicates.
- Seeded playgrounds have `createdBy: null` (system) to distinguish them from
  user-added ones.
- Override the source file with `SEED_FILE=berlin-playgrounds.json npm run seed:emulator`.
