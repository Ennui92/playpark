-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Family profiles — bio + avatar storage                                   ║
-- ║                                                                          ║
-- ║ Adds a short bio column on families and creates an avatars storage      ║
-- ║ bucket with public-read / owner-write policies. Avatars are uploaded    ║
-- ║ from the client via expo-image-picker → Supabase Storage at path       ║
-- ║ `<family_id>.jpg`; the resulting public URL is then written to         ║
-- ║ families.avatar_url (column already existed since 0001).                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table public.families
  add column if not exists bio text check (bio is null or char_length(bio) <= 280);

-- ─── Storage bucket: avatars (public read) ─────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;

-- Anyone can read avatar files (they're rendered by Image components for
-- friends; restricting would require signed URLs that don't survive
-- across token refresh, not worth the friction at this scale).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- A family can upload/overwrite ONLY a file named `<their_family_id>.<ext>`.
-- We enforce this with name-pattern check: the file basename (before the
-- first dot) must equal the caller's family_id.
drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (
      split_part(name, '.', 1)::uuid = auth_family_id()
    )
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and split_part(name, '.', 1)::uuid = auth_family_id()
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and split_part(name, '.', 1)::uuid = auth_family_id()
  );

-- ─── Trigger: push when a broadcast's message updates ──────────────────────
-- The user can update their broadcast's `message` to signal status changes
-- ("Running 10 min late", "Just arrived", "Heading home"). When the message
-- changes (or when ended_at goes from null to not-null), fan out a push to
-- friends who RSVPed coming or maybe.
create or replace function public.dispatch_broadcast_update_push()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  payload jsonb;
  is_status_change boolean;
  is_ended         boolean;
begin
  is_status_change := coalesce(new.message, '') <> coalesce(old.message, '');
  is_ended := old.ended_at is null and new.ended_at is not null;
  if not (is_status_change or is_ended) then
    return new;
  end if;

  payload := jsonb_build_object(
    'type', 'UPDATE',
    'table', 'broadcasts',
    'schema', 'public',
    'record', to_jsonb(new),
    'old_record', to_jsonb(old)
  );
  perform net.http_post(
    url := 'https://vqwzyrydhsourpkjdmot.supabase.co/functions/v1/on_broadcast_updated',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload
  );
  return new;
end $$;

drop trigger if exists broadcast_update_push_fanout on public.broadcasts;
create trigger broadcast_update_push_fanout
  after update on public.broadcasts
  for each row execute function public.dispatch_broadcast_update_push();
