-- Extend the landmark category enum with three new types that surfaced
-- from real Berlin use:
--   square      — public plazas (Kollwitzplatz, Boxhagener Platz, etc.)
--   flea_market — Flohmarkt, Trödelmarkt, weekly markets
--   event       — a place known for hosting events (Markthalle, etc.)
--
-- splash_pad stays in the constraint for legacy rows even though it's
-- hidden from the UI.

alter table public.landmarks
  drop constraint if exists landmarks_category_check;

alter table public.landmarks
  add constraint landmarks_category_check
  check (category in (
    'playground','park','splash_pad','library','indoor_play',
    'cafe','community_center','square','flea_market','event','other'
  ));
