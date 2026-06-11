-- Give places a stable identity using Google's placeId so the same
-- real-world place resolves to ONE canonical landmark row shared across
-- families — instead of each family creating its own duplicate. This
-- dedups pins and aligns "notify me when someone broadcasts this place"
-- subscriptions onto the same row.

alter table landmarks add column if not exists place_id text;

-- One canonical row per Google place. Partial index so the many legacy
-- rows with a null place_id (manually-pinned, or seeded before this
-- change) are unaffected and can coexist.
create unique index if not exists landmarks_place_id_key
  on landmarks (place_id) where place_id is not null;
