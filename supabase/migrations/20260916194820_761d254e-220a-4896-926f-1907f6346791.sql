-- roles
create type public.app_role as enum ('admin','analyst','viewer');
create type public.case_type as enum ('person','business');
create type public.case_status as enum ('pending','in_review','approved','rejected');
create type public.risk_level as enum ('low','medium','high');
create type public.check_result as enum ('pass','fail','review','not_run');
create type public.hit_category as enum ('sanctions','pep','rca','watchlist','adverse_media');
create type public.hit_disposition as enum ('open','true_positive','false_positive');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by signed in" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.can_write(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','analyst'))
$$;

create or replace function public.has_any_role(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create policy "roles readable by signed in" on public.user_roles for select to authenticated using (true);
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
grant insert, update, delete on public.user_roles to authenticated;

-- new user: profile + bootstrap role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  select not exists (select 1 from public.user_roles) into first_user;
  insert into public.user_roles (user_id, role)
  values (new.id, case when first_user then 'admin'::public.app_role else 'viewer'::public.app_role end)
  on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- cases
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  case_type public.case_type not null,
  subject_name text not null,
  country text,
  status public.case_status not null default 'pending',
  risk_level public.risk_level not null default 'low',
  risk_score int not null default 0,
  assigned_to uuid references auth.users(id) on delete set null,
  decision_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.cases to authenticated;
grant all on public.cases to service_role;
alter table public.cases enable row level security;
create trigger cases_touch before update on public.cases for each row execute function public.touch_updated_at();
create policy "cases read" on public.cases for select to authenticated using (public.has_any_role(auth.uid()));
create policy "cases insert" on public.cases for insert to authenticated with check (public.can_write(auth.uid()));
create policy "cases update" on public.cases for update to authenticated using (public.can_write(auth.uid())) with check (public.can_write(auth.uid()));
create policy "cases delete" on public.cases for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.case_checks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  category text not null,
  name text not null,
  result public.check_result not null default 'not_run',
  detail text,
  source text,
  checked_at timestamptz not null default now()
);
grant select, insert, update, delete on public.case_checks to authenticated;
grant all on public.case_checks to service_role;
alter table public.case_checks enable row level security;
create policy "checks read" on public.case_checks for select to authenticated using (public.has_any_role(auth.uid()));
create policy "checks write" on public.case_checks for all to authenticated using (public.can_write(auth.uid())) with check (public.can_write(auth.uid()));

create table public.business_owners (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null,
  ownership_pct numeric(5,2),
  control_role text,
  screening_status text not null default 'pending',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.business_owners to authenticated;
grant all on public.business_owners to service_role;
alter table public.business_owners enable row level security;
create policy "owners read" on public.business_owners for select to authenticated using (public.has_any_role(auth.uid()));
create policy "owners write" on public.business_owners for all to authenticated using (public.can_write(auth.uid())) with check (public.can_write(auth.uid()));

create table public.screening_hits (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  list_name text not null,
  list_version text,
  matched_name text not null,
  match_score numeric(4,3),
  category public.hit_category not null,
  detail text,
  disposition public.hit_disposition not null default 'open',
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.screening_hits to authenticated;
grant all on public.screening_hits to service_role;
alter table public.screening_hits enable row level security;
create policy "hits read" on public.screening_hits for select to authenticated using (public.has_any_role(auth.uid()));
create policy "hits write" on public.screening_hits for all to authenticated using (public.can_write(auth.uid())) with check (public.can_write(auth.uid()));

create table public.monitoring_alerts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  alert_type text not null,
  detail text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.monitoring_alerts to authenticated;
grant all on public.monitoring_alerts to service_role;
alter table public.monitoring_alerts enable row level security;
create policy "alerts read" on public.monitoring_alerts for select to authenticated using (public.has_any_role(auth.uid()));
create policy "alerts write" on public.monitoring_alerts for all to authenticated using (public.can_write(auth.uid())) with check (public.can_write(auth.uid()));

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_events to authenticated;
grant all on public.audit_events to service_role;
alter table public.audit_events enable row level security;
create policy "audit read" on public.audit_events for select to authenticated using (public.has_any_role(auth.uid()));
create policy "audit append" on public.audit_events for insert to authenticated with check (actor_id = auth.uid());

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  environment text not null default 'sandbox',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
grant select, insert, update on public.api_keys to authenticated;
grant all on public.api_keys to service_role;
alter table public.api_keys enable row level security;
create policy "keys read" on public.api_keys for select to authenticated using (public.has_any_role(auth.uid()));
create policy "keys admin write" on public.api_keys for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- illustrative demo data
insert into public.cases (id, reference, case_type, subject_name, country, status, risk_level, risk_score) values
 ('11111111-1111-4111-8111-111111111111','CASE-10241','person','Amara Okonkwo','CA','in_review','medium',54),
 ('22222222-2222-4222-8222-222222222222','CASE-10242','person','Liam Trembley','CA','approved','low',12),
 ('33333333-3333-4333-8333-333333333333','CASE-10243','business','Northline Freight Ltd.','CA','in_review','high',81),
 ('44444444-4444-4444-8444-444444444444','CASE-10244','person','Sofia Marchetti','IT','pending','medium',47),
 ('55555555-5555-4555-8555-555555555555','business_placeholder_ref_fix','business','Prairie Exchange Inc.','CA','approved','low',20);
update public.cases set reference = 'CASE-10245' where reference = 'business_placeholder_ref_fix';

insert into public.case_checks (case_id, category, name, result, detail, source) values
 ('11111111-1111-4111-8111-111111111111','document','Passport authenticity','pass','MRZ parsed and checksum valid','Document engine'),
 ('11111111-1111-4111-8111-111111111111','biometric','Liveness','pass','Active challenge completed','Biometric engine'),
 ('11111111-1111-4111-8111-111111111111','biometric','Face to document match','pass','0.94 similarity','Biometric engine'),
 ('11111111-1111-4111-8111-111111111111','identity','Address verification','review','Single source match only','Credit file'),
 ('11111111-1111-4111-8111-111111111111','risk','Device and network','pass','No proxy or emulator signals','Device intelligence'),
 ('22222222-2222-4222-8222-222222222222','document','Driver licence authenticity','pass','Barcode and front data agree','Document engine'),
 ('22222222-2222-4222-8222-222222222222','identity','Dual process method','pass','Two independent sources matched','Credit file'),
 ('33333333-3333-4333-8333-333333333333','entity','Registry status','pass','Active, federally incorporated','Corporations Canada'),
 ('33333333-3333-4333-8333-333333333333','entity','Directors and officers','review','One director not identified','Registry'),
 ('33333333-3333-4333-8333-333333333333','ownership','Beneficial ownership traced','review','25% held through a holding company','Registry + declaration'),
 ('44444444-4444-4444-8444-444444444444','document','ID authenticity','not_run','Awaiting document upload','Document engine');

insert into public.business_owners (case_id, name, ownership_pct, control_role, screening_status) values
 ('33333333-3333-4333-8333-333333333333','Viktor Halyna',42.00,'Director and shareholder','hit'),
 ('33333333-3333-4333-8333-333333333333','Meredith Cole',33.00,'Shareholder','clear'),
 ('33333333-3333-4333-8333-333333333333','Halyna Holdings Ltd.',25.00,'Corporate shareholder','pending'),
 ('55555555-5555-4555-8555-555555555555','Jean-Pierre Caron',100.00,'Sole shareholder and director','clear');

insert into public.screening_hits (case_id, list_name, list_version, matched_name, match_score, category, detail, disposition) values
 ('11111111-1111-4111-8111-111111111111','Consolidated PEP list','2026-09-14','Amara Okonkwa',0.870,'pep','Municipal office holder, different date of birth','open'),
 ('33333333-3333-4333-8333-333333333333','OFAC SDN','2026-09-15','Viktor Halyna',0.930,'sanctions','Name and year of birth match','open'),
 ('33333333-3333-4333-8333-333333333333','Adverse media','2026-09-15','Northline Freight','0.610','adverse_media','Reported customs investigation, 2024','open'),
 ('22222222-2222-4222-8222-222222222222','Canadian Autonomous Sanctions','2026-09-10','L. Tremblay',0.550,'sanctions','Common surname, no other identifiers agree','false_positive');

insert into public.monitoring_alerts (case_id, alert_type, detail, status) values
 ('22222222-2222-4222-8222-222222222222','list_update','Name appeared on an updated watchlist extract','open'),
 ('55555555-5555-4555-8555-555555555555','registry_change','Director change filed with the registry','closed');