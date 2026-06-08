-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Guard: at most one active broadcast per family                           ║
-- ║                                                                          ║
-- ║ Without this guard, a user can tap "Broadcast" twice (or broadcast at   ║
-- ║ two different landmarks back-to-back) and have multiple active          ║
-- ║ broadcasts at once. Confirmed in production data: at least two families ║
-- ║ have double-broadcasts in the last hour.                                ║
-- ║                                                                          ║
-- ║ Approach: BEFORE INSERT trigger raises an exception when an active     ║
-- ║ broadcast already exists for the same family. The client catches and    ║
-- ║ surfaces a friendly message ("You're already broadcasting — end or     ║
-- ║ update that one first").                                                ║
-- ║                                                                          ║
-- ║ Note: We use an exception rather than auto-ending the prior broadcast  ║
-- ║ because (a) the broadcast_update_push trigger would spam a "wrapped     ║
-- ║ up" notification, and (b) explicit failure surfaces the intent gap     ║
-- ║ instead of silently swallowing a double-tap.                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create or replace function public.guard_one_active_broadcast()
returns trigger
language plpgsql security definer set search_path = public as $$
declare existing_id uuid;
begin
  select id into existing_id
    from public.broadcasts
   where family_id = new.family_id
     and ended_at is null
     and expires_at > now();
  if existing_id is not null then
    -- Custom error code so the client can detect this specifically.
    raise exception 'already broadcasting'
      using errcode = 'P0001', hint = existing_id::text;
  end if;
  return new;
end $$;

drop trigger if exists guard_one_active_broadcast_before_insert on public.broadcasts;
create trigger guard_one_active_broadcast_before_insert
  before insert on public.broadcasts
  for each row execute function public.guard_one_active_broadcast();

-- Clean up the existing duplicates so the new guard doesn't trip the
-- next time anyone tries to broadcast. Keep the most recent per family.
with ranked as (
  select id, family_id,
         row_number() over (partition by family_id order by created_at desc) as rn
    from public.broadcasts
   where ended_at is null and expires_at > now()
)
update public.broadcasts b
   set ended_at = now()
  from ranked r
 where b.id = r.id and r.rn > 1;
