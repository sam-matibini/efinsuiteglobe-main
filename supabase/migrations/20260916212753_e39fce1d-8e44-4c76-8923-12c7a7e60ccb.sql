-- 1. Tables
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
grant select, insert, update, delete on public.organization_members to authenticated;
grant all on public.organization_members to service_role;
alter table public.organization_members enable row level security;

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'viewer',
  token_hash text not null unique,
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index organization_invites_email_idx on public.organization_invites (lower(email));
grant select, insert, update on public.organization_invites to authenticated;
grant all on public.organization_invites to service_role;
alter table public.organization_invites enable row level security;

create trigger organizations_touch before update on public.organizations
for each row execute function public.touch_updated_at();

-- 2. Helpers
create or replace function public.current_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.organization_members where user_id = auth.uid()
$$;

create or replace function public.is_org_member(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where org_id = _org and user_id = auth.uid())
$$;

create or replace function public.has_org_role(_org uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where org_id = _org and user_id = auth.uid() and role = _role)
$$;

create or replace function public.can_write_org(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where org_id = _org and user_id = auth.uid() and role in ('admin','analyst'))
$$;

revoke execute on function public.current_org_ids() from public, anon;
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.has_org_role(uuid, public.app_role) from public, anon;
revoke execute on function public.can_write_org(uuid) from public, anon;
grant execute on function public.current_org_ids() to authenticated, service_role;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.has_org_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.can_write_org(uuid) to authenticated, service_role;

-- 3. Policies for the new tables
create policy "orgs read own" on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy "orgs insert" on public.organizations for insert to authenticated
  with check (created_by = auth.uid());
create policy "orgs admin update" on public.organizations for update to authenticated
  using (public.has_org_role(id, 'admin')) with check (public.has_org_role(id, 'admin'));

create policy "members read" on public.organization_members for select to authenticated
  using (public.is_org_member(org_id));
create policy "members admin write" on public.organization_members for all to authenticated
  using (public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'admin'));

create policy "invites read" on public.organization_invites for select to authenticated
  using (public.is_org_member(org_id));
create policy "invites admin write" on public.organization_invites for all to authenticated
  using (public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'admin'));

-- 4. Mirror membership into the legacy user_roles table
create or replace function public.sync_user_roles_from_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.user_roles where user_id = old.user_id;
    return old;
  end if;
  delete from public.user_roles where user_id = new.user_id;
  insert into public.user_roles (user_id, role) values (new.user_id, new.role)
    on conflict do nothing;
  return new;
end;
$$;
create trigger organization_members_sync_roles
after insert or update or delete on public.organization_members
for each row execute function public.sync_user_roles_from_membership();

-- 5. Seed the existing workspace as one organization
insert into public.organizations (id, name, slug, created_by)
values ('00000000-0000-4000-8000-000000000001', 'eterfaceID', 'eterfaceid',
        (select user_id from public.user_roles where role = 'admin' order by created_at limit 1));

insert into public.organization_members (org_id, user_id, role)
select '00000000-0000-4000-8000-000000000001', ur.user_id, ur.role from public.user_roles ur
on conflict do nothing;

-- 6. Add org_id to every tenant table
alter table public.cases add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.case_checks add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.case_addresses add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.business_owners add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.screening_runs add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.screening_hits add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.monitoring_alerts add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.documents add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.selfies add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.verification_sessions add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.device_signals add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.risk_factors add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.transactions add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.transaction_alerts add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.regulatory_reports add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.api_keys add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.webhook_endpoints add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.webhook_deliveries add column org_id uuid references public.organizations(id) on delete cascade;
alter table public.audit_events add column org_id uuid references public.organizations(id) on delete cascade;

update public.cases set org_id = '00000000-0000-4000-8000-000000000001';
update public.case_checks set org_id = '00000000-0000-4000-8000-000000000001';
update public.case_addresses set org_id = '00000000-0000-4000-8000-000000000001';
update public.business_owners set org_id = '00000000-0000-4000-8000-000000000001';
update public.screening_runs set org_id = '00000000-0000-4000-8000-000000000001';
update public.screening_hits set org_id = '00000000-0000-4000-8000-000000000001';
update public.monitoring_alerts set org_id = '00000000-0000-4000-8000-000000000001';
update public.documents set org_id = '00000000-0000-4000-8000-000000000001';
update public.selfies set org_id = '00000000-0000-4000-8000-000000000001';
update public.verification_sessions set org_id = '00000000-0000-4000-8000-000000000001';
update public.device_signals set org_id = '00000000-0000-4000-8000-000000000001';
update public.risk_factors set org_id = '00000000-0000-4000-8000-000000000001';
update public.transactions set org_id = '00000000-0000-4000-8000-000000000001';
update public.transaction_alerts set org_id = '00000000-0000-4000-8000-000000000001';
update public.regulatory_reports set org_id = '00000000-0000-4000-8000-000000000001';
update public.api_keys set org_id = '00000000-0000-4000-8000-000000000001';
update public.webhook_endpoints set org_id = '00000000-0000-4000-8000-000000000001';
update public.webhook_deliveries set org_id = '00000000-0000-4000-8000-000000000001';
update public.audit_events set org_id = '00000000-0000-4000-8000-000000000001';

alter table public.cases alter column org_id set not null;
alter table public.case_checks alter column org_id set not null;
alter table public.case_addresses alter column org_id set not null;
alter table public.business_owners alter column org_id set not null;
alter table public.screening_runs alter column org_id set not null;
alter table public.screening_hits alter column org_id set not null;
alter table public.monitoring_alerts alter column org_id set not null;
alter table public.documents alter column org_id set not null;
alter table public.selfies alter column org_id set not null;
alter table public.verification_sessions alter column org_id set not null;
alter table public.device_signals alter column org_id set not null;
alter table public.risk_factors alter column org_id set not null;
alter table public.transactions alter column org_id set not null;
alter table public.transaction_alerts alter column org_id set not null;
alter table public.regulatory_reports alter column org_id set not null;
alter table public.api_keys alter column org_id set not null;
alter table public.webhook_endpoints alter column org_id set not null;
alter table public.webhook_deliveries alter column org_id set not null;
alter table public.audit_events alter column org_id set not null;

create index cases_org_idx on public.cases (org_id);
create index case_checks_org_idx on public.case_checks (org_id);
create index case_addresses_org_idx on public.case_addresses (org_id);
create index business_owners_org_idx on public.business_owners (org_id);
create index screening_runs_org_idx on public.screening_runs (org_id);
create index screening_hits_org_idx on public.screening_hits (org_id);
create index monitoring_alerts_org_idx on public.monitoring_alerts (org_id);
create index documents_org_idx on public.documents (org_id);
create index selfies_org_idx on public.selfies (org_id);
create index verification_sessions_org_idx on public.verification_sessions (org_id);
create index device_signals_org_idx on public.device_signals (org_id);
create index risk_factors_org_idx on public.risk_factors (org_id);
create index transactions_org_idx on public.transactions (org_id);
create index transaction_alerts_org_idx on public.transaction_alerts (org_id);
create index regulatory_reports_org_idx on public.regulatory_reports (org_id);
create index api_keys_org_idx on public.api_keys (org_id);
create index webhook_endpoints_org_idx on public.webhook_endpoints (org_id);
create index webhook_deliveries_org_idx on public.webhook_deliveries (org_id);
create index audit_events_org_idx on public.audit_events (org_id);

-- 7. Replace policies with org-scoped ones
drop policy "cases read" on public.cases;
drop policy "cases insert" on public.cases;
drop policy "cases update" on public.cases;
drop policy "cases delete" on public.cases;
create policy "cases read" on public.cases for select to authenticated using (public.is_org_member(org_id));
create policy "cases insert" on public.cases for insert to authenticated with check (public.can_write_org(org_id));
create policy "cases update" on public.cases for update to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));
create policy "cases delete" on public.cases for delete to authenticated using (public.has_org_role(org_id, 'admin'));

drop policy "checks read" on public.case_checks;
drop policy "checks write" on public.case_checks;
create policy "checks read" on public.case_checks for select to authenticated using (public.is_org_member(org_id));
create policy "checks write" on public.case_checks for all to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

drop policy "addresses read" on public.case_addresses;
drop policy "addresses insert" on public.case_addresses;
drop policy "addresses update" on public.case_addresses;
create policy "addresses read" on public.case_addresses for select to authenticated using (public.is_org_member(org_id));
create policy "addresses insert" on public.case_addresses for insert to authenticated with check (public.can_write_org(org_id));
create policy "addresses update" on public.case_addresses for update to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

drop policy "owners read" on public.business_owners;
drop policy "owners write" on public.business_owners;
create policy "owners read" on public.business_owners for select to authenticated using (public.is_org_member(org_id));
create policy "owners write" on public.business_owners for all to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

drop policy "runs read" on public.screening_runs;
drop policy "runs insert" on public.screening_runs;
create policy "runs read" on public.screening_runs for select to authenticated using (public.is_org_member(org_id));
create policy "runs insert" on public.screening_runs for insert to authenticated with check (public.can_write_org(org_id));

drop policy "hits read" on public.screening_hits;
drop policy "hits write" on public.screening_hits;
create policy "hits read" on public.screening_hits for select to authenticated using (public.is_org_member(org_id));
create policy "hits write" on public.screening_hits for all to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

drop policy "alerts read" on public.monitoring_alerts;
drop policy "alerts write" on public.monitoring_alerts;
create policy "alerts read" on public.monitoring_alerts for select to authenticated using (public.is_org_member(org_id));
create policy "alerts write" on public.monitoring_alerts for all to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

drop policy "documents read" on public.documents;
drop policy "documents insert" on public.documents;
drop policy "documents update" on public.documents;
create policy "documents read" on public.documents for select to authenticated using (public.is_org_member(org_id));
create policy "documents insert" on public.documents for insert to authenticated with check (public.can_write_org(org_id));
create policy "documents update" on public.documents for update to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

drop policy "selfies read" on public.selfies;
drop policy "selfies insert" on public.selfies;
drop policy "selfies update" on public.selfies;
create policy "selfies read" on public.selfies for select to authenticated using (public.is_org_member(org_id));
create policy "selfies insert" on public.selfies for insert to authenticated with check (public.can_write_org(org_id));
create policy "selfies update" on public.selfies for update to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

drop policy "sessions read" on public.verification_sessions;
drop policy "sessions insert" on public.verification_sessions;
drop policy "sessions update" on public.verification_sessions;
create policy "sessions read" on public.verification_sessions for select to authenticated using (public.is_org_member(org_id));
create policy "sessions insert" on public.verification_sessions for insert to authenticated with check (public.can_write_org(org_id));
create policy "sessions update" on public.verification_sessions for update to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

drop policy "device read" on public.device_signals;
drop policy "device insert" on public.device_signals;
create policy "device read" on public.device_signals for select to authenticated using (public.is_org_member(org_id));
create policy "device insert" on public.device_signals for insert to authenticated with check (public.can_write_org(org_id));

drop policy "risk read" on public.risk_factors;
drop policy "risk write" on public.risk_factors;
create policy "risk read" on public.risk_factors for select to authenticated using (public.is_org_member(org_id));
create policy "risk write" on public.risk_factors for all to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

drop policy "transactions read" on public.transactions;
drop policy "transactions insert" on public.transactions;
drop policy "transactions update" on public.transactions;
create policy "transactions read" on public.transactions for select to authenticated using (public.is_org_member(org_id));
create policy "transactions insert" on public.transactions for insert to authenticated with check (public.can_write_org(org_id));
create policy "transactions update" on public.transactions for update to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

drop policy "tx alerts read" on public.transaction_alerts;
drop policy "tx alerts insert" on public.transaction_alerts;
drop policy "tx alerts update" on public.transaction_alerts;
create policy "tx alerts read" on public.transaction_alerts for select to authenticated using (public.is_org_member(org_id));
create policy "tx alerts insert" on public.transaction_alerts for insert to authenticated with check (public.can_write_org(org_id));
create policy "tx alerts update" on public.transaction_alerts for update to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

drop policy "reports read" on public.regulatory_reports;
drop policy "reports insert" on public.regulatory_reports;
drop policy "reports update" on public.regulatory_reports;
create policy "reports read" on public.regulatory_reports for select to authenticated using (public.is_org_member(org_id));
create policy "reports insert" on public.regulatory_reports for insert to authenticated with check (public.can_write_org(org_id));
create policy "reports update" on public.regulatory_reports for update to authenticated using (public.can_write_org(org_id)) with check (public.can_write_org(org_id));

drop policy "keys read" on public.api_keys;
drop policy "keys admin write" on public.api_keys;
create policy "keys read" on public.api_keys for select to authenticated using (public.is_org_member(org_id));
create policy "keys admin write" on public.api_keys for all to authenticated using (public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'admin'));

drop policy "webhooks read" on public.webhook_endpoints;
drop policy "webhooks admin write" on public.webhook_endpoints;
create policy "webhooks read" on public.webhook_endpoints for select to authenticated using (public.is_org_member(org_id));
create policy "webhooks admin write" on public.webhook_endpoints for all to authenticated using (public.has_org_role(org_id, 'admin')) with check (public.has_org_role(org_id, 'admin'));

drop policy "deliveries read" on public.webhook_deliveries;
create policy "deliveries read" on public.webhook_deliveries for select to authenticated using (public.is_org_member(org_id));

drop policy "audit read" on public.audit_events;
drop policy "audit append" on public.audit_events;
create policy "audit read" on public.audit_events for select to authenticated using (public.is_org_member(org_id));
create policy "audit append" on public.audit_events for insert to authenticated with check (public.is_org_member(org_id) and actor_id = auth.uid());

-- 8. Profiles and user_roles visibility scoped to teammates
drop policy "profiles readable by signed in" on public.profiles;
create policy "profiles readable by teammates" on public.profiles for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.organization_members m
    where m.user_id = profiles.id and m.org_id in (select public.current_org_ids())
  ));

drop policy "roles readable by signed in" on public.user_roles;
drop policy "admins manage roles" on public.user_roles;
create policy "roles readable by self" on public.user_roles for select to authenticated
  using (user_id = auth.uid());

-- 9. New signups no longer become global admins
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;