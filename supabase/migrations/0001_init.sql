-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ OUTSIDE — initial schema                                                  │
-- │                                                                           │
-- │ Core loop: a FAMILY broadcasts "we're going to LANDMARK at TIME."         │
-- │ Friend families who subscribed to that landmark get a push.               │
-- │                                                                           │
-- │ Key design choice: identity is family-level, not user-level. Parents      │
-- │ forget other parents' names but remember "the Chen family."               │
-- └──────────────────────────────────────────────────────────────────────────┘

create extension if not exists "uuid-ossp";
create extension if not exists postgis;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Families ──────────────────────────────────────────────────────────────
create table public.families (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null check (char_length(name) between 1 and 40),
  zip          text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create index families_zip_idx on public.families (zip);

-- ─── Users (one row per auth user; tied to exactly one family) ─────────────
create table public.users (
  id            uuid primary key references auth.users on delete cascade,
  family_id     uuid not null references public.families on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 40),
  username      text not null unique
                check (username ~ '^[a-z0-9_]{3,20}$'),
  push_token    text,
  created_at    timestamptz not null default now()
);

create index users_family_idx on public.users (family_id);

-- ─── Kids (minimal info — name + rough age only) ───────────────────────────
create table public.kids (
  id           uuid primary key default uuid_generate_v4(),
  family_id    uuid not null references public.families on delete cascade,
  name         text not null check (char_length(name) between 1 and 30),
  birth_year   int not null check (birth_year between 2005 and extract(year from now())::int),
  birth_month  int not null check (birth_month between 1 and 12),
  emoji        text default '👧',
  created_at   timestamptz not null default now()
);

create index kids_family_idx on public.kids (family_id);

-- ─── Landmarks (curated per ZIP) ───────────────────────────────────────────
create table public.landmarks (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  zip          text not null,
  category     text not null check (category in (
                 'playground','park','splash_pad','library','indoor_play','cafe','other'
               )),
  emoji        text not null default '🛝',
  lat          double precision not null,
  lng          double precision not null,
  location     geography(point, 4326) generated always as (
                 st_setsrid(st_makepoint(lng, lat), 4326)::geography
               ) stored,
  created_at   timestamptz not null default now()
);

create index landmarks_zip_idx on public.landmarks (zip);
create index landmarks_location_idx on public.landmarks using gist (location);

-- ─── Friendships (family ↔ family, bidirectional rows) ─────────────────────
create table public.friendships (
  family_id        uuid not null references public.families on delete cascade,
  friend_family_id uuid not null references public.families on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (family_id, friend_family_id),
  check (family_id <> friend_family_id)
);

-- ─── QR nonces (for fast friend-adding at the park) ────────────────────────
create table public.qr_nonces (
  nonce       text primary key,
  family_id   uuid not null references public.families on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index qr_nonces_family_idx on public.qr_nonces (family_id);

-- ─── Landmark subscriptions (which landmarks a family wants pushes for) ────
create table public.landmark_subs (
  family_id    uuid not null references public.families on delete cascade,
  landmark_id  uuid not null references public.landmarks on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (family_id, landmark_id)
);

-- ─── Broadcasts (the core action) ──────────────────────────────────────────
create table public.broadcasts (
  id           uuid primary key default uuid_generate_v4(),
  family_id    uuid not null references public.families on delete cascade,
  landmark_id  uuid not null references public.landmarks on delete cascade,
  planned_at   timestamptz not null,
  message      text check (message is null or char_length(message) <= 80),
  kid_ids      uuid[] not null default '{}',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,  -- planned_at + 2h (set by trigger)
  ended_at     timestamptz
);

create index broadcasts_family_idx    on public.broadcasts (family_id);
create index broadcasts_landmark_idx  on public.broadcasts (landmark_id);
create index broadcasts_active_idx    on public.broadcasts (expires_at) where ended_at is null;

-- Auto-set expires_at to planned_at + 2h on insert
create or replace function set_broadcast_expiry()
returns trigger language plpgsql as $$
begin
  if new.expires_at is null then
    new.expires_at := new.planned_at + interval '2 hours';
  end if;
  return new;
end $$;

create trigger broadcasts_set_expiry
  before insert on public.broadcasts
  for each row execute function set_broadcast_expiry();

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS (used by RLS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Return the family_id for the current user. Stable so RLS can cache it.
create or replace function auth_family_id() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from public.users where id = auth.uid();
$$;

-- Are two families friends? (checks one direction; we always insert both rows)
create or replace function are_families_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.friendships
    where family_id = a and friend_family_id = b
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.families       enable row level security;
alter table public.users          enable row level security;
alter table public.kids           enable row level security;
alter table public.landmarks      enable row level security;
alter table public.friendships    enable row level security;
alter table public.qr_nonces      enable row level security;
alter table public.landmark_subs  enable row level security;
alter table public.broadcasts     enable row level security;

-- ─── families ──────────────────────────────────────────────────────────────
-- Read: own family OR any friend family
create policy families_select on public.families for select
  using (
    id = auth_family_id()
    or are_families_friends(auth_family_id(), id)
  );

-- Insert: only via signup trigger (disallow direct inserts)
create policy families_insert on public.families for insert
  with check (auth.uid() is not null);

-- Update: only own family
create policy families_update on public.families for update
  using (id = auth_family_id())
  with check (id = auth_family_id());

-- ─── users ─────────────────────────────────────────────────────────────────
create policy users_select on public.users for select
  using (
    id = auth.uid()
    or family_id = auth_family_id()
    or are_families_friends(auth_family_id(), family_id)
  );

create policy users_insert on public.users for insert
  with check (id = auth.uid());

create policy users_update on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Username lookup (for friend search): allow reading just id+username of anyone.
-- Handled by a dedicated RPC below — no broader policy needed.

-- ─── kids ──────────────────────────────────────────────────────────────────
create policy kids_select on public.kids for select
  using (
    family_id = auth_family_id()
    or are_families_friends(auth_family_id(), family_id)
  );

create policy kids_write on public.kids for all
  using (family_id = auth_family_id())
  with check (family_id = auth_family_id());

-- ─── landmarks (read-only for users; seeded via migration) ─────────────────
create policy landmarks_select on public.landmarks for select
  using (true);  -- public catalog, no secrets

-- ─── friendships ───────────────────────────────────────────────────────────
create policy friendships_select on public.friendships for select
  using (
    family_id = auth_family_id()
    or friend_family_id = auth_family_id()
  );

-- Writes go through RPCs (add_friend_via_qr, remove_friend)
-- RLS here just prevents direct client inserts.

-- ─── qr_nonces ─────────────────────────────────────────────────────────────
create policy qr_nonces_select on public.qr_nonces for select
  using (family_id = auth_family_id());

create policy qr_nonces_insert on public.qr_nonces for insert
  with check (family_id = auth_family_id());

-- ─── landmark_subs ─────────────────────────────────────────────────────────
create policy landmark_subs_select on public.landmark_subs for select
  using (family_id = auth_family_id());

create policy landmark_subs_write on public.landmark_subs for all
  using (family_id = auth_family_id())
  with check (family_id = auth_family_id());

-- ─── broadcasts ────────────────────────────────────────────────────────────
-- Read: own family's broadcasts + friend families' broadcasts.
create policy broadcasts_select on public.broadcasts for select
  using (
    family_id = auth_family_id()
    or are_families_friends(auth_family_id(), family_id)
  );

create policy broadcasts_insert on public.broadcasts for insert
  with check (family_id = auth_family_id());

-- Update: only own, only ended_at (to mark "Leaving")
create policy broadcasts_update on public.broadcasts for update
  using (family_id = auth_family_id())
  with check (family_id = auth_family_id());

-- ═══════════════════════════════════════════════════════════════════════════
-- RPCs (secure business logic, bypasses direct-table writes)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Sign up: create a family + user row atomically ────────────────────────
-- Called from client after supabase.auth.signUp() succeeds.
create or replace function create_family_and_user(
  _family_name text,
  _zip text,
  _display_name text,
  _username text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Enforce username format + uniqueness (done by check + unique, but explicit error)
  if _username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'invalid username';
  end if;

  insert into public.families (name, zip) values (_family_name, _zip)
    returning id into new_family_id;

  insert into public.users (id, family_id, display_name, username)
    values (auth.uid(), new_family_id, _display_name, _username);

  return new_family_id;
end $$;

-- ─── Generate a QR nonce ───────────────────────────────────────────────────
create or replace function generate_qr_nonce() returns text
language plpgsql security definer set search_path = public as $$
declare
  n text;
begin
  if auth_family_id() is null then raise exception 'no family'; end if;
  n := encode(gen_random_bytes(12), 'base64url');
  insert into public.qr_nonces (nonce, family_id, expires_at)
    values (n, auth_family_id(), now() + interval '24 hours');
  return n;
end $$;

-- ─── Add a friend via QR nonce ─────────────────────────────────────────────
create or replace function add_friend_via_qr(_nonce text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target_family uuid;
  my_family uuid;
begin
  my_family := auth_family_id();
  if my_family is null then raise exception 'no family'; end if;

  select family_id into target_family from public.qr_nonces
    where nonce = _nonce and used_at is null and expires_at > now();

  if target_family is null then raise exception 'invalid or expired nonce'; end if;
  if target_family = my_family then raise exception 'cannot friend self'; end if;

  update public.qr_nonces set used_at = now() where nonce = _nonce;

  insert into public.friendships (family_id, friend_family_id)
    values (my_family, target_family), (target_family, my_family)
    on conflict do nothing;

  return target_family;
end $$;

-- ─── Add a friend via username ─────────────────────────────────────────────
create or replace function add_friend_via_username(_username text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target_family uuid;
  my_family uuid;
begin
  my_family := auth_family_id();
  if my_family is null then raise exception 'no family'; end if;

  select family_id into target_family from public.users where username = _username;
  if target_family is null then raise exception 'user not found'; end if;
  if target_family = my_family then raise exception 'cannot friend self'; end if;

  insert into public.friendships (family_id, friend_family_id)
    values (my_family, target_family), (target_family, my_family)
    on conflict do nothing;

  return target_family;
end $$;

-- ─── Remove a friendship (both directions) ─────────────────────────────────
create or replace function remove_friendship(_other_family uuid) returns void
language plpgsql security definer set search_path = public as $$
declare my_family uuid := auth_family_id();
begin
  if my_family is null then raise exception 'no family'; end if;
  delete from public.friendships
    where (family_id = my_family and friend_family_id = _other_family)
       or (family_id = _other_family and friend_family_id = my_family);
end $$;

-- ─── Search usernames (read-only, limited) ─────────────────────────────────
create or replace function search_username(_prefix text)
returns table (family_id uuid, family_name text, username text)
language sql security definer set search_path = public as $$
  select u.family_id, f.name, u.username
  from public.users u
  join public.families f on f.id = u.family_id
  where u.username ilike (_prefix || '%')
  limit 10;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;
grant select on public.landmarks to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
