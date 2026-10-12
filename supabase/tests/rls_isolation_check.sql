-- Row Level Security isolation check for Eco Field Lab.
--
-- Creates two throwaway users, has user A write an investigation, dataset,
-- rows, analysis, notebook entry and achievement, then confirms user B and a
-- guest (anon) cannot read, change, delete, forge or attach to any of it.
-- Everything is deleted again at the end (deleting the users cascades).
-- Run in the Supabase SQL editor; every row of the final result should say passed = true.

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-a@example.invalid', '{"display_name":"Tester A"}', '{}', now(), now()),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-b@example.invalid', '{}', '{}', now(), now());

create temp table rls_results (check_name text, passed boolean, detail text);
grant all on rls_results to authenticated, anon;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', false);
insert into public.investigations (id, mode, title, ecosystem_id, mission_id) values ('aaaaaaaa-1111-4000-8000-000000000001', 'simulation', 'A private investigation', 'grassland', 'grassland-trampling');
insert into public.datasets (id, investigation_id, name, kind) values ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'A data', 'quadrat');
insert into rls_results select 'A can write rows via RPC', public.replace_dataset_rows('aaaaaaaa-2222-4000-8000-000000000001', '[{"cells":{"count":12}},{"cells":{"count":8}},{"cells":{"count":15}}]'::jsonb) = 3, 'rows inserted';
insert into public.notebook_entries (id, investigation_id, title, conclusion) values ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'A entry', 'secret');
insert into public.analyses (investigation_id, dataset_id, type, title) values ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000001', 't-test', 'A test');
insert into public.user_achievements (achievement_id) values ('data-detective');
insert into rls_results select 'A reads own investigation', count(*) = 1, count(*)::text from public.investigations;
insert into rls_results select 'A reads own profile (created by trigger)', count(*) = 1, max(display_name) from public.profiles;

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', false);
insert into rls_results select 'B cannot read A investigations', count(*) = 0, count(*)::text from public.investigations;
insert into rls_results select 'B cannot read A datasets', count(*) = 0, count(*)::text from public.datasets;
insert into rls_results select 'B cannot read A dataset rows', count(*) = 0, count(*)::text from public.dataset_rows;
insert into rls_results select 'B cannot read A notebook entries', count(*) = 0, count(*)::text from public.notebook_entries;
insert into rls_results select 'B cannot read A analyses', count(*) = 0, count(*)::text from public.analyses;
insert into rls_results select 'B cannot read A achievements', count(*) = 0, count(*)::text from public.user_achievements;
insert into rls_results select 'B cannot read A profile', count(*) = 1, count(*)::text || ' visible (own only)' from public.profiles;
with u as (update public.investigations set title = 'hacked' where id = 'aaaaaaaa-1111-4000-8000-000000000001' returning 1)
insert into rls_results select 'B cannot update A investigation', count(*) = 0, count(*)::text || ' rows updated' from u;
with d as (delete from public.notebook_entries where id = 'aaaaaaaa-3333-4000-8000-000000000001' returning 1)
insert into rls_results select 'B cannot delete A notebook entry', count(*) = 0, count(*)::text || ' rows deleted' from d;
do $$ begin
  insert into public.datasets (investigation_id, name, kind) values ('aaaaaaaa-1111-4000-8000-000000000001', 'intrusion', 'custom');
  insert into rls_results values ('B cannot attach a dataset to A investigation', false, 'insert succeeded');
exception when others then
  insert into rls_results values ('B cannot attach a dataset to A investigation', true, sqlerrm);
end $$;
do $$ begin
  perform public.replace_dataset_rows('aaaaaaaa-2222-4000-8000-000000000001', '[]'::jsonb);
  insert into rls_results values ('B cannot overwrite A rows via RPC', false, 'rpc succeeded');
exception when others then
  insert into rls_results values ('B cannot overwrite A rows via RPC', true, sqlerrm);
end $$;
do $$ begin
  insert into public.investigations (user_id, mode, title) values ('aaaaaaaa-0000-4000-8000-000000000001', 'my-data', 'forged owner');
  insert into rls_results values ('B cannot create rows owned by A', false, 'insert succeeded');
exception when others then
  insert into rls_results values ('B cannot create rows owned by A', true, sqlerrm);
end $$;
do $$ begin
  insert into public.ecosystems (id, name, tagline, description, methods) values ('fake', 'x', 'x', 'x', '{}');
  insert into rls_results values ('Users cannot write the catalogue', false, 'insert succeeded');
exception when others then
  insert into rls_results values ('Users cannot write the catalogue', true, sqlerrm);
end $$;

reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
insert into rls_results select 'Guests can read the catalogue', count(*) = 8, count(*)::text from public.ecosystems;
do $$ begin
  perform count(*) from public.investigations;
  insert into rls_results values ('Guests cannot read investigations', false, 'select succeeded');
exception when others then
  insert into rls_results values ('Guests cannot read investigations', true, sqlerrm);
end $$;
do $$ begin
  perform count(*) from public.notebook_entries;
  insert into rls_results values ('Guests cannot read notebook entries', false, 'select succeeded');
exception when others then
  insert into rls_results values ('Guests cannot read notebook entries', true, sqlerrm);
end $$;

reset role;
insert into rls_results select 'A data intact after B attempts', count(*) = 3, count(*)::text || ' rows' from public.dataset_rows where dataset_id = 'aaaaaaaa-2222-4000-8000-000000000001';
insert into rls_results select 'A title unchanged', bool_and(title = 'A private investigation'), max(title) from public.investigations where id = 'aaaaaaaa-1111-4000-8000-000000000001';
delete from auth.users where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002');
insert into rls_results select 'Cleanup cascades (no test rows left)',
  (select count(*) from public.investigations where id = 'aaaaaaaa-1111-4000-8000-000000000001') = 0, 'deleted';
select * from rls_results;
