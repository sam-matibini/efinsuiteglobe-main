create extension if not exists pg_trgm;

create table public.watchlist_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  category hit_category not null,
  jurisdiction text,
  homepage text,
  feed_url text not null,
  enabled boolean not null default true,
  entity_count integer not null default 0,
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.watchlist_sources to authenticated;
grant all on public.watchlist_sources to service_role;
alter table public.watchlist_sources enable row level security;
create policy "sources read" on public.watchlist_sources for select to authenticated using (has_any_role(auth.uid()));
create policy "sources admin write" on public.watchlist_sources for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
create trigger watchlist_sources_touch before update on public.watchlist_sources for each row execute function public.touch_updated_at();

create table public.watchlist_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.watchlist_sources(id) on delete cascade,
  version_label text not null,
  status text not null default 'running',
  row_count integer not null default 0,
  added_count integer not null default 0,
  changed_count integer not null default 0,
  removed_count integer not null default 0,
  error_detail text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
grant select on public.watchlist_versions to authenticated;
grant all on public.watchlist_versions to service_role;
alter table public.watchlist_versions enable row level security;
create policy "versions read" on public.watchlist_versions for select to authenticated using (has_any_role(auth.uid()));
create index on public.watchlist_versions (source_id, started_at desc);

create table public.watchlist_entities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.watchlist_sources(id) on delete cascade,
  version_id uuid references public.watchlist_versions(id) on delete set null,
  external_id text not null,
  entity_schema text not null default 'Person',
  name text not null,
  name_norm text not null,
  aliases text[] not null default '{}',
  birth_date text,
  countries text[] not null default '{}',
  identifiers text,
  programs text,
  content_hash text not null,
  last_change text,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);
grant select on public.watchlist_entities to authenticated;
grant all on public.watchlist_entities to service_role;
alter table public.watchlist_entities enable row level security;
create policy "entities read" on public.watchlist_entities for select to authenticated using (has_any_role(auth.uid()));
create index on public.watchlist_entities (source_id);

create table public.watchlist_names (
  id bigserial primary key,
  entity_id uuid not null references public.watchlist_entities(id) on delete cascade,
  source_id uuid not null references public.watchlist_sources(id) on delete cascade,
  name text not null,
  name_norm text not null,
  kind text not null default 'primary'
);
grant select on public.watchlist_names to authenticated;
grant all on public.watchlist_names to service_role;
alter table public.watchlist_names enable row level security;
create policy "names read" on public.watchlist_names for select to authenticated using (has_any_role(auth.uid()));
create index watchlist_names_trgm on public.watchlist_names using gin (name_norm gin_trgm_ops);
create index on public.watchlist_names (entity_id);

create table public.screening_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  subject_name text not null,
  subject_type case_type not null default 'person',
  birth_date text,
  country text,
  engine_version text not null default 'eid-match-1',
  candidates_examined integer not null default 0,
  hit_count integer not null default 0,
  threshold numeric not null default 0.72,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
grant select, insert on public.screening_runs to authenticated;
grant all on public.screening_runs to service_role;
alter table public.screening_runs enable row level security;
create policy "runs read" on public.screening_runs for select to authenticated using (has_any_role(auth.uid()));
create policy "runs insert" on public.screening_runs for insert to authenticated with check (can_write(auth.uid()));
create index on public.screening_runs (case_id, created_at desc);

alter table public.screening_hits
  add column if not exists entity_id uuid references public.watchlist_entities(id) on delete set null,
  add column if not exists run_id uuid references public.screening_runs(id) on delete set null,
  add column if not exists reasons jsonb not null default '[]'::jsonb;

create or replace function public.match_watchlist_names(_q text, _threshold real default 0.4, _limit integer default 200)
returns table (entity_id uuid, source_id uuid, matched_name text, matched_norm text, kind text, sim real)
language sql
stable
security definer
set search_path to public
as $$
  select n.entity_id, n.source_id, n.name, n.name_norm, n.kind,
         similarity(n.name_norm, _q) as sim
  from public.watchlist_names n
  join public.watchlist_entities e on e.id = n.entity_id
  where e.removed_at is null
    and similarity(n.name_norm, _q) >= _threshold
  order by similarity(n.name_norm, _q) desc
  limit _limit
$$;
grant execute on function public.match_watchlist_names(text, real, integer) to authenticated, service_role;

insert into public.watchlist_sources (code, title, category, jurisdiction, homepage, feed_url) values
 ('un_sc_sanctions','UN Security Council Consolidated Sanctions','sanctions','UN','https://www.un.org/securitycouncil/content/un-sc-consolidated-list','https://data.opensanctions.org/datasets/latest/un_sc_sanctions/targets.simple.csv'),
 ('us_ofac_sdn','US OFAC Specially Designated Nationals','sanctions','US','https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists','https://data.opensanctions.org/datasets/latest/us_ofac_sdn/targets.simple.csv'),
 ('eu_fsf','EU Financial Sanctions Files','sanctions','EU','https://www.sanctionsmap.eu/','https://data.opensanctions.org/datasets/latest/eu_fsf/targets.simple.csv'),
 ('ca_dfatd_sema_sanctions','Canadian Consolidated Autonomous Sanctions (SEMA)','sanctions','CA','https://www.international.gc.ca/world-monde/international_relations-relations_internationales/sanctions/consolidated-consolide.aspx','https://data.opensanctions.org/datasets/latest/ca_dfatd_sema_sanctions/targets.simple.csv'),
 ('ca_listed_terrorists','Canadian Listed Terrorist Entities','watchlist','CA','https://www.publicsafety.gc.ca/cnt/ntnl-scrt/cntr-trrrsm/lstd-ntts/crrnt-lstd-ntts-en.aspx','https://data.opensanctions.org/datasets/latest/ca_listed_terrorists/targets.simple.csv'),
 ('ca_facfoa','Canada Freezing Assets of Corrupt Foreign Officials','sanctions','CA','https://www.international.gc.ca/world-monde/international_relations-relations_internationales/sanctions/','https://data.opensanctions.org/datasets/latest/ca_facfoa/targets.simple.csv'),
 ('ca_commons','Canada Members of the House of Commons','pep','CA','https://www.ourcommons.ca/members/en','https://data.opensanctions.org/datasets/latest/ca_commons/targets.simple.csv'),
 ('ca_senate','Canada Members of the Senate','pep','CA','https://sencanada.ca/en/senators/','https://data.opensanctions.org/datasets/latest/ca_senate/targets.simple.csv'),
 ('ca_foreign_reps','Foreign Representatives in Canada','pep','CA','https://www.international.gc.ca/protocol-protocole/','https://data.opensanctions.org/datasets/latest/ca_foreign_reps/targets.simple.csv');