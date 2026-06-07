-- Strip ALL seeded landmarks (curated 0002 + 0005 + OSM 0007).
--
-- Why: real coordinates from OSM and our hand-curated set are unreliable.
-- "Kranoldplatz" mapped to a flea market; many OSM playgrounds resolved
-- to a perimeter vertex instead of the actual play area. Rather than
-- chase data quality on a shared catalog, we pivot to user-driven:
-- each family searches Google Places (canonical coords) and contributes
-- the spots they actually use. Creators can fine-tune the pin and
-- delete their own contributions; visibility stays public-per-ZIP for
-- network effects.
--
-- This deletes only seeded rows (created_by_family_id IS NULL); any
-- user-added landmarks are preserved.

delete from public.landmarks where created_by_family_id is null;
