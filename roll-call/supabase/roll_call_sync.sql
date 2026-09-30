-- Live sync for the Bhutan roll call (Supabase project "bhutan-roll-call", ap-south-1).
-- Already applied. Kept here so the database can be rebuilt.
-- Tables have RLS on and no policies: the anon key can only call rc_push / rc_pull,
-- and both refuse unless p_key matches the sync key derived from the trip code.
-- rc_secret stores only sha256(sync key), never the key itself.

create extension if not exists pgcrypto with schema extensions;

create table public.rc_marks (
  check_id text not null check (char_length(check_id) between 1 and 64),
  student_id text not null check (char_length(student_id) between 1 and 32),
  status text null check (status in ('P','A','E')),
  at bigint not null,
  srv bigint not null,
  primary key (check_id, student_id)
);
create index rc_marks_srv_idx on public.rc_marks (srv);

create table public.rc_secret (k text primary key);

alter table public.rc_marks enable row level security;
alter table public.rc_secret enable row level security;
revoke all on public.rc_marks, public.rc_secret from anon, authenticated;

create or replace function public.rc_key_ok(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_key is not null and char_length(p_key) = 64 and exists (
    select 1 from public.rc_secret s
    where s.k = encode(extensions.digest(convert_to(p_key, 'UTF8'), 'sha256'), 'hex'));
$$;
revoke all on function public.rc_key_ok(text) from public, anon, authenticated;

create or replace function public.rc_push(p_key text, p_marks jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_n int;
begin
  if not public.rc_key_ok(p_key) then raise exception 'bad key' using errcode = '28000'; end if;
  if p_marks is null or jsonb_typeof(p_marks) <> 'array' then return jsonb_build_object('now', v_now, 'n', 0); end if;
  if jsonb_array_length(p_marks) > 3000 then raise exception 'too many marks'; end if;

  insert into public.rc_marks as m (check_id, student_id, status, at, srv)
  select distinct on (x.c, x.s) x.c, x.s, nullif(x.st, ''), x.at, v_now
  from jsonb_to_recordset(p_marks) as x(c text, s text, st text, at bigint)
  where x.c is not null and x.s is not null and x.at is not null
    and char_length(x.c) between 1 and 64 and char_length(x.s) between 1 and 32
    and (x.st is null or x.st in ('', 'P', 'A', 'E'))
    and x.at > 0 and x.at < v_now + 86400000
  order by x.c, x.s, x.at desc
  on conflict (check_id, student_id) do update
    set status = excluded.status, at = excluded.at, srv = excluded.srv
    where excluded.at > m.at;
  get diagnostics v_n = row_count;
  return jsonb_build_object('now', v_now, 'n', v_n);
end $$;

create or replace function public.rc_pull(p_key text, p_since bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if not public.rc_key_ok(p_key) then raise exception 'bad key' using errcode = '28000'; end if;
  return jsonb_build_object('now', v_now, 'marks', coalesce((
    select jsonb_agg(jsonb_build_object('c', check_id, 's', student_id, 'st', status, 'at', at, 'srv', srv))
    from public.rc_marks where srv > coalesce(p_since, 0)), '[]'::jsonb));
end $$;

revoke all on function public.rc_push(text, jsonb), public.rc_pull(text, bigint) from public, authenticated;
grant execute on function public.rc_push(text, jsonb), public.rc_pull(text, bigint) to anon;

-- Then register the sync key hash (tools/lock_roster.py prints this line):
-- insert into public.rc_secret(k) values ('<sha256 of sync key>');
