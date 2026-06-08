-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Round 2A: friend requests (no more auto-add) + broadcast RSVPs           ║
-- ║                                                                          ║
-- ║ Previously, add_friend_via_qr / add_friend_via_username inserted a       ║
-- ║ bidirectional friendship pair immediately. Anyone with a handle or       ║
-- ║ scanned QR became an instant friend — the friended party had no say.    ║
-- ║                                                                          ║
-- ║ Now both RPCs insert a row into friend_requests (status='pending') and  ║
-- ║ the recipient accepts or declines via the new RPCs.                     ║
-- ║                                                                          ║
-- ║ Mutual-interest fast path: if A requests B AND B already has a pending  ║
-- ║ request out to A, we auto-accept and create the friendship immediately. ║
-- ║                                                                          ║
-- ║ broadcast_rsvps lets friends signal coming / maybe / not_coming on a    ║
-- ║ broadcast. The broadcaster sees the aggregate.                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ─── friend_requests table ─────────────────────────────────────────────────
create table public.friend_requests (
  id              uuid primary key default uuid_generate_v4(),
  from_family_id  uuid not null references public.families on delete cascade,
  to_family_id    uuid not null references public.families on delete cascade,
  status          text not null default 'pending' check (status in ('pending')),
  created_at      timestamptz not null default now(),
  -- A pair can only have one open pending request at a time. We don't
  -- store declined/accepted history — declined just deletes the row, and
  -- accepted moves the link into the friendships table.
  unique (from_family_id, to_family_id),
  check (from_family_id <> to_family_id)
);
create index friend_requests_to_idx   on public.friend_requests (to_family_id);
create index friend_requests_from_idx on public.friend_requests (from_family_id);

alter table public.friend_requests enable row level security;

-- Recipient can see requests addressed to them. Sender can see their own
-- outgoing (lets the UI show "Request sent — pending").
create policy friend_requests_select on public.friend_requests for select
  using (
    to_family_id   = auth_family_id()
    or from_family_id = auth_family_id()
  );

-- All writes go through SECURITY DEFINER RPCs; no direct client writes.

-- ─── broadcast_rsvps table ─────────────────────────────────────────────────
create table public.broadcast_rsvps (
  broadcast_id uuid not null references public.broadcasts on delete cascade,
  family_id    uuid not null references public.families on delete cascade,
  status       text not null check (status in ('coming', 'maybe', 'not_coming')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (broadcast_id, family_id)
);
create index broadcast_rsvps_broadcast_idx on public.broadcast_rsvps (broadcast_id);
create index broadcast_rsvps_family_idx    on public.broadcast_rsvps (family_id);

alter table public.broadcast_rsvps enable row level security;

-- Visible to: the RSVPing family + the broadcasting family + any friend
-- families of the broadcaster (since they see the broadcast already, they
-- can see who's coming too — encourages "if X is going, I'll go").
create policy broadcast_rsvps_select on public.broadcast_rsvps for select
  using (
    family_id = auth_family_id()
    or broadcast_id in (
      select id from public.broadcasts
      where family_id = auth_family_id()
        or are_families_friends(auth_family_id(), family_id)
    )
  );

create policy broadcast_rsvps_write on public.broadcast_rsvps for all
  using (family_id = auth_family_id())
  with check (family_id = auth_family_id());

-- ─── Replace add_friend_via_qr to create a REQUEST instead ─────────────────
create or replace function add_friend_via_qr(_nonce text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target_family uuid;
  my_family    uuid;
  existing_back uuid;
begin
  my_family := auth_family_id();
  if my_family is null then raise exception 'no family'; end if;

  select family_id into target_family
    from public.qr_nonces
   where nonce = _nonce and used_at is null and expires_at > now();
  if target_family is null then raise exception 'invalid or expired nonce'; end if;
  if target_family = my_family then raise exception 'cannot friend self'; end if;

  -- Already friends? No-op.
  if are_families_friends(my_family, target_family) then
    return target_family;
  end if;

  update public.qr_nonces set used_at = now() where nonce = _nonce;

  -- Mutual-interest fast path: if the target ALREADY sent us a request,
  -- auto-accept both ways. No extra round-trip required.
  select id into existing_back
    from public.friend_requests
   where from_family_id = target_family and to_family_id = my_family;
  if existing_back is not null then
    insert into public.friendships (family_id, friend_family_id)
      values (my_family, target_family), (target_family, my_family)
      on conflict do nothing;
    delete from public.friend_requests where id = existing_back;
    return target_family;
  end if;

  -- Standard path: insert (or refresh) a pending request.
  insert into public.friend_requests (from_family_id, to_family_id)
    values (my_family, target_family)
    on conflict (from_family_id, to_family_id) do nothing;

  return target_family;
end $$;

-- ─── Replace add_friend_via_username to create a REQUEST ───────────────────
create or replace function add_friend_via_username(_username text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target_family uuid;
  my_family    uuid;
  existing_back uuid;
begin
  my_family := auth_family_id();
  if my_family is null then raise exception 'no family'; end if;

  select family_id into target_family
    from public.users where username = _username;
  if target_family is null then raise exception 'user not found'; end if;
  if target_family = my_family then raise exception 'cannot friend self'; end if;

  if are_families_friends(my_family, target_family) then
    return target_family;
  end if;

  select id into existing_back
    from public.friend_requests
   where from_family_id = target_family and to_family_id = my_family;
  if existing_back is not null then
    insert into public.friendships (family_id, friend_family_id)
      values (my_family, target_family), (target_family, my_family)
      on conflict do nothing;
    delete from public.friend_requests where id = existing_back;
    return target_family;
  end if;

  insert into public.friend_requests (from_family_id, to_family_id)
    values (my_family, target_family)
    on conflict (from_family_id, to_family_id) do nothing;

  return target_family;
end $$;

-- ─── Accept / decline RPCs ─────────────────────────────────────────────────
create or replace function accept_friend_request(_request_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  my_family   uuid := auth_family_id();
  from_family uuid;
begin
  if my_family is null then raise exception 'no family'; end if;
  select from_family_id into from_family
    from public.friend_requests
   where id = _request_id and to_family_id = my_family;
  if from_family is null then raise exception 'request not found'; end if;

  insert into public.friendships (family_id, friend_family_id)
    values (my_family, from_family), (from_family, my_family)
    on conflict do nothing;

  delete from public.friend_requests where id = _request_id;
  return from_family;
end $$;

create or replace function decline_friend_request(_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  my_family uuid := auth_family_id();
begin
  if my_family is null then raise exception 'no family'; end if;
  -- Silent decline — no row remains, sender sees their outgoing disappear.
  delete from public.friend_requests
   where id = _request_id and to_family_id = my_family;
end $$;

-- ─── set_broadcast_rsvp ────────────────────────────────────────────────────
create or replace function set_broadcast_rsvp(_broadcast_id uuid, _status text)
  returns void
language plpgsql security definer set search_path = public as $$
declare
  my_family uuid := auth_family_id();
begin
  if my_family is null then raise exception 'no family'; end if;
  if _status not in ('coming', 'maybe', 'not_coming') then
    raise exception 'invalid status';
  end if;

  -- Caller must be a friend of the broadcaster OR the broadcaster themselves.
  -- RLS on insert would handle it but we want a clearer error.
  if not exists (
    select 1 from public.broadcasts b
     where b.id = _broadcast_id
       and (b.family_id = my_family or are_families_friends(my_family, b.family_id))
  ) then
    raise exception 'not allowed';
  end if;

  insert into public.broadcast_rsvps (broadcast_id, family_id, status)
    values (_broadcast_id, my_family, _status)
    on conflict (broadcast_id, family_id)
    do update set status = excluded.status, updated_at = now();
end $$;

-- ─── Triggers for push notifications ───────────────────────────────────────
-- Friend request created → notify the recipient.
create or replace function public.dispatch_friend_request_push()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'friend_requests',
    'schema', 'public',
    'record', to_jsonb(new),
    'old_record', null
  );
  perform net.http_post(
    url := 'https://vqwzyrydhsourpkjdmot.supabase.co/functions/v1/on_friend_request_created',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload
  );
  return new;
end $$;

create trigger friend_request_push_fanout
  after insert on public.friend_requests
  for each row execute function public.dispatch_friend_request_push();

-- RSVP changed (insert or update) → notify the broadcaster.
create or replace function public.dispatch_rsvp_push()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type', tg_op,
    'table', 'broadcast_rsvps',
    'schema', 'public',
    'record', to_jsonb(new),
    'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
  );
  perform net.http_post(
    url := 'https://vqwzyrydhsourpkjdmot.supabase.co/functions/v1/on_broadcast_rsvp_changed',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload
  );
  return new;
end $$;

create trigger rsvp_push_fanout
  after insert or update on public.broadcast_rsvps
  for each row execute function public.dispatch_rsvp_push();

-- ─── Grants for new functions ──────────────────────────────────────────────
grant execute on function accept_friend_request(uuid)  to authenticated;
grant execute on function decline_friend_request(uuid) to authenticated;
grant execute on function set_broadcast_rsvp(uuid, text) to authenticated;
