-- Wire the on_broadcast_created Edge Function as an INSERT trigger using pg_net.
-- pg_net is a Supabase-provided extension that schedules HTTP calls
-- asynchronously, so the INSERT latency isn't affected by the push fan-out.

create extension if not exists pg_net with schema extensions;

create or replace function public.dispatch_broadcast_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  payload jsonb;
begin
  -- Mimic the Supabase Database Webhook body shape so the edge function's
  -- existing parser (payload.type / payload.table / payload.record) works
  -- without changes.
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'broadcasts',
    'schema', 'public',
    'record', to_jsonb(new),
    'old_record', null
  );

  perform net.http_post(
    url := 'https://vqwzyrydhsourpkjdmot.supabase.co/functions/v1/on_broadcast_created',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload
  );

  return new;
end;
$$;

create trigger broadcast_push_fanout
  after insert on public.broadcasts
  for each row execute function public.dispatch_broadcast_push();
