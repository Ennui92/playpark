-- Per-place MUTE. Every friend broadcast pings all friends by default; a
-- row here means this family has silenced broadcasts for one landmark.
-- (Replaces the old opt-IN landmark_subs model, which became a no-op once
-- the push fan-out switched to "all friends".) Mirrors landmark_subs RLS.

create table if not exists public.landmark_mutes (
  family_id   uuid not null references public.families(id)  on delete cascade,
  landmark_id uuid not null references public.landmarks(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (family_id, landmark_id)
);

alter table public.landmark_mutes enable row level security;

create policy landmark_mutes_select on public.landmark_mutes
  for select using (family_id = auth_family_id());

create policy landmark_mutes_write on public.landmark_mutes
  for all using (family_id = auth_family_id())
  with check (family_id = auth_family_id());
