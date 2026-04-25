-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ Favorites + user-added landmarks                                           │
-- └──────────────────────────────────────────────────────────────────────────┘

-- ─── Allow user-added landmarks ────────────────────────────────────────────
alter table public.landmarks
  add column if not exists created_by_family_id uuid
    references public.families on delete set null;

create index if not exists landmarks_creator_idx
  on public.landmarks (created_by_family_id);

-- A family can insert a landmark it owns.
create policy landmarks_insert on public.landmarks for insert
  with check (created_by_family_id = auth_family_id());

-- And delete / update only its own contributions.
create policy landmarks_update on public.landmarks for update
  using (created_by_family_id = auth_family_id())
  with check (created_by_family_id = auth_family_id());

create policy landmarks_delete on public.landmarks for delete
  using (created_by_family_id = auth_family_id());

-- ─── Favorites table ───────────────────────────────────────────────────────
create table if not exists public.landmark_favorites (
  family_id    uuid not null references public.families on delete cascade,
  landmark_id  uuid not null references public.landmarks on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (family_id, landmark_id)
);

alter table public.landmark_favorites enable row level security;

create policy favs_select on public.landmark_favorites for select
  using (family_id = auth_family_id());

create policy favs_write on public.landmark_favorites for all
  using (family_id = auth_family_id())
  with check (family_id = auth_family_id());
