-- Add "community_center" to the landmark category enum.
-- Keep splash_pad valid in DB (existing rows) but the UI no longer offers it.

alter table public.landmarks
  drop constraint if exists landmarks_category_check;

alter table public.landmarks
  add constraint landmarks_category_check
  check (category in (
    'playground','park','splash_pad','library','indoor_play',
    'cafe','community_center','other'
  ));
