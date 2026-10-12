-- Eco Field Lab — initial schema.
--
-- Catalogue tables (ecosystems, missions, achievements) are public and read-only.
-- Everything a student creates is owned by their auth user and protected by Row
-- Level Security, so a user can only ever see or change their own rows.
-- Simulation state is not stored: a site is reconstructed from its ecosystem and
-- site code, and only the datasets a student chooses to save are persisted.

-- ── helpers ────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles ───────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  reputation integer not null default 0 check (reputation >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── catalogue (seeded separately) ──────────────────────────────────────────

create table public.ecosystems (
  id text primary key,
  name text not null,
  tagline text not null,
  description text not null,
  methods text[] not null,
  sort_order integer not null default 0
);

create table public.missions (
  id text primary key,
  ecosystem_id text not null references public.ecosystems (id) on delete cascade,
  title text not null,
  question text not null,
  hypothesis text not null,
  null_hypothesis text not null,
  focal_species text not null,
  recommended_methods text[] not null,
  sort_order integer not null default 0
);

create index missions_ecosystem_id_idx on public.missions (ecosystem_id);

create table public.achievements (
  id text primary key,
  title text not null,
  description text not null,
  points integer not null default 0,
  sort_order integer not null default 0
);

-- ── student work ───────────────────────────────────────────────────────────

create table public.investigations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode text not null check (mode in ('simulation', 'my-data')),
  ecosystem_id text references public.ecosystems (id) on delete set null,
  mission_id text references public.missions (id) on delete set null,
  site_code text check (char_length(site_code) <= 32),
  title text not null check (char_length(title) between 1 and 200),
  research_question text not null default '',
  hypothesis text not null default '',
  sampling_method text not null default '',
  sample_size integer check (sample_size >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index investigations_user_id_idx on public.investigations (user_id);
create index investigations_ecosystem_id_idx on public.investigations (ecosystem_id);
create index investigations_mission_id_idx on public.investigations (mission_id);
create trigger investigations_updated_at before update on public.investigations
  for each row execute function public.set_updated_at();

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  investigation_id uuid references public.investigations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  kind text not null check (kind in ('quadrat', 'line-transect', 'belt-transect', 'custom', 'frequency')),
  source text not null default 'user' check (source in ('simulation', 'user', 'example')),
  columns jsonb not null default '[]'::jsonb check (jsonb_typeof(columns) = 'array'),
  value_column text,
  group_column text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index datasets_user_id_idx on public.datasets (user_id);
create index datasets_investigation_id_idx on public.datasets (investigation_id);
create trigger datasets_updated_at before update on public.datasets
  for each row execute function public.set_updated_at();

create table public.dataset_rows (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null check (position >= 0),
  cells jsonb not null default '{}'::jsonb check (jsonb_typeof(cells) = 'object'),
  unique (dataset_id, position)
);

create index dataset_rows_user_id_idx on public.dataset_rows (user_id);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  investigation_id uuid references public.investigations (id) on delete cascade,
  dataset_id uuid references public.datasets (id) on delete set null,
  type text not null check (type in ('descriptive', 't-test', 'chi-squared-gof', 'chi-squared-independence')),
  title text not null,
  parameters jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analyses_user_id_idx on public.analyses (user_id);
create index analyses_investigation_id_idx on public.analyses (investigation_id);
create index analyses_dataset_id_idx on public.analyses (dataset_id);

create table public.notebook_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  investigation_id uuid not null references public.investigations (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  dataset_ids uuid[] not null default '{}',
  descriptive jsonb not null default '[]'::jsonb,
  tests jsonb not null default '[]'::jsonb,
  charts jsonb not null default '[]'::jsonb,
  conclusion text not null default '',
  limitations text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notebook_entries_user_id_idx on public.notebook_entries (user_id);
create index notebook_entries_investigation_id_idx on public.notebook_entries (investigation_id);
create trigger notebook_entries_updated_at before update on public.notebook_entries
  for each row execute function public.set_updated_at();

create table public.user_achievements (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create index user_achievements_achievement_id_idx on public.user_achievements (achievement_id);

-- ── row level security ─────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.ecosystems enable row level security;
alter table public.missions enable row level security;
alter table public.achievements enable row level security;
alter table public.investigations enable row level security;
alter table public.datasets enable row level security;
alter table public.dataset_rows enable row level security;
alter table public.analyses enable row level security;
alter table public.notebook_entries enable row level security;
alter table public.user_achievements enable row level security;

-- Catalogue: anyone may read, nobody may write through the API.
create policy "Catalogue is public" on public.ecosystems for select to anon, authenticated using (true);
create policy "Catalogue is public" on public.missions for select to anon, authenticated using (true);
create policy "Catalogue is public" on public.achievements for select to anon, authenticated using (true);

-- Profiles: own row only (rows are created by the signup trigger).
create policy "Read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Investigations.
create policy "Read own investigations" on public.investigations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Create own investigations" on public.investigations for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Update own investigations" on public.investigations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Delete own investigations" on public.investigations for delete to authenticated
  using (user_id = (select auth.uid()));

-- Datasets: may only be attached to the owner's own investigation.
create policy "Read own datasets" on public.datasets for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Create own datasets" on public.datasets for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (investigation_id is null or exists (
      select 1 from public.investigations i where i.id = investigation_id and i.user_id = (select auth.uid())))
  );
create policy "Update own datasets" on public.datasets for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (investigation_id is null or exists (
      select 1 from public.investigations i where i.id = investigation_id and i.user_id = (select auth.uid())))
  );
create policy "Delete own datasets" on public.datasets for delete to authenticated
  using (user_id = (select auth.uid()));

-- Dataset rows: only inside the owner's own dataset.
create policy "Read own dataset rows" on public.dataset_rows for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Create own dataset rows" on public.dataset_rows for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.datasets d where d.id = dataset_id and d.user_id = (select auth.uid()))
  );
create policy "Update own dataset rows" on public.dataset_rows for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.datasets d where d.id = dataset_id and d.user_id = (select auth.uid()))
  );
create policy "Delete own dataset rows" on public.dataset_rows for delete to authenticated
  using (user_id = (select auth.uid()));

-- Analyses.
create policy "Read own analyses" on public.analyses for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Create own analyses" on public.analyses for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (investigation_id is null or exists (
      select 1 from public.investigations i where i.id = investigation_id and i.user_id = (select auth.uid())))
    and (dataset_id is null or exists (
      select 1 from public.datasets d where d.id = dataset_id and d.user_id = (select auth.uid())))
  );
create policy "Update own analyses" on public.analyses for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (investigation_id is null or exists (
      select 1 from public.investigations i where i.id = investigation_id and i.user_id = (select auth.uid())))
    and (dataset_id is null or exists (
      select 1 from public.datasets d where d.id = dataset_id and d.user_id = (select auth.uid())))
  );
create policy "Delete own analyses" on public.analyses for delete to authenticated
  using (user_id = (select auth.uid()));

-- Notebook entries.
create policy "Read own notebook entries" on public.notebook_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Create own notebook entries" on public.notebook_entries for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.investigations i where i.id = investigation_id and i.user_id = (select auth.uid()))
  );
create policy "Update own notebook entries" on public.notebook_entries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.investigations i where i.id = investigation_id and i.user_id = (select auth.uid()))
  );
create policy "Delete own notebook entries" on public.notebook_entries for delete to authenticated
  using (user_id = (select auth.uid()));

-- Earned achievements.
create policy "Read own achievements" on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Record own achievements" on public.user_achievements for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Update own achievements" on public.user_achievements for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── grants ─────────────────────────────────────────────────────────────────
-- Guests (anon) can read the catalogue only. RLS above scopes signed-in users.

revoke all on public.profiles, public.investigations, public.datasets, public.dataset_rows,
  public.analyses, public.notebook_entries, public.user_achievements from anon;
revoke insert, update, delete on public.ecosystems, public.missions, public.achievements from anon, authenticated;

-- ── replace a dataset's rows in one transaction ───────────────────────────

create or replace function public.replace_dataset_rows(p_dataset_id uuid, p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted integer;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a JSON array' using errcode = '22023';
  end if;
  if not exists (select 1 from public.datasets d where d.id = p_dataset_id and d.user_id = (select auth.uid())) then
    raise exception 'dataset not found' using errcode = 'P0002';
  end if;
  delete from public.dataset_rows where dataset_id = p_dataset_id;
  insert into public.dataset_rows (dataset_id, user_id, position, cells)
  select p_dataset_id, (select auth.uid()), (r.ordinality - 1)::integer, coalesce(r.value -> 'cells', '{}'::jsonb)
  from jsonb_array_elements(p_rows) with ordinality as r(value, ordinality);
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke execute on function public.replace_dataset_rows(uuid, jsonb) from public, anon;
grant execute on function public.replace_dataset_rows(uuid, jsonb) to authenticated;
