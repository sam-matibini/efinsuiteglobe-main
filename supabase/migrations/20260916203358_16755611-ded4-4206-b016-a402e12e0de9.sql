
create table public.verification_sessions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  channel text not null default 'console',
  status text not null default 'open',
  expires_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.verification_sessions to authenticated;
grant all on public.verification_sessions to service_role;
alter table public.verification_sessions enable row level security;
create policy "sessions read" on public.verification_sessions for select to authenticated using (has_any_role(auth.uid()));
create policy "sessions insert" on public.verification_sessions for insert to authenticated with check (can_write(auth.uid()));
create policy "sessions update" on public.verification_sessions for update to authenticated using (can_write(auth.uid())) with check (can_write(auth.uid()));

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  session_id uuid references public.verification_sessions(id) on delete set null,
  doc_type text not null,
  issuing_country text,
  issuing_region text,
  document_number text,
  surname text,
  given_names text,
  birth_date date,
  issue_date date,
  expiry_date date,
  mrz_raw text,
  mrz_valid boolean,
  checks jsonb not null default '[]'::jsonb,
  integrity jsonb not null default '{}'::jsonb,
  result check_result not null default 'not_run',
  storage_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "documents read" on public.documents for select to authenticated using (has_any_role(auth.uid()));
create policy "documents insert" on public.documents for insert to authenticated with check (can_write(auth.uid()));
create policy "documents update" on public.documents for update to authenticated using (can_write(auth.uid())) with check (can_write(auth.uid()));

create table public.selfies (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  session_id uuid references public.verification_sessions(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  challenge text,
  liveness_score numeric,
  liveness_signals jsonb not null default '{}'::jsonb,
  face_match_score numeric,
  face_match_status text not null default 'pending',
  quality jsonb not null default '{}'::jsonb,
  result check_result not null default 'not_run',
  storage_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.selfies to authenticated;
grant all on public.selfies to service_role;
alter table public.selfies enable row level security;
create policy "selfies read" on public.selfies for select to authenticated using (has_any_role(auth.uid()));
create policy "selfies insert" on public.selfies for insert to authenticated with check (can_write(auth.uid()));
create policy "selfies update" on public.selfies for update to authenticated using (can_write(auth.uid())) with check (can_write(auth.uid()));

create table public.device_signals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  session_id uuid references public.verification_sessions(id) on delete set null,
  fingerprint text,
  user_agent text,
  platform text,
  timezone text,
  languages text[],
  screen text,
  ip_address text,
  ip_country text,
  claimed_country text,
  is_datacenter boolean not null default false,
  is_vpn boolean not null default false,
  is_tor boolean not null default false,
  repeat_device_cases integer not null default 0,
  velocity_24h integer not null default 0,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.device_signals to authenticated;
grant all on public.device_signals to service_role;
alter table public.device_signals enable row level security;
create policy "device read" on public.device_signals for select to authenticated using (has_any_role(auth.uid()));
create policy "device insert" on public.device_signals for insert to authenticated with check (can_write(auth.uid()));
create index device_signals_fingerprint_idx on public.device_signals (fingerprint);

create table public.risk_factors (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  category text not null,
  code text not null,
  label text not null,
  weight integer not null default 0,
  detail text,
  source text not null default 'in-house',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.risk_factors to authenticated;
grant all on public.risk_factors to service_role;
alter table public.risk_factors enable row level security;
create policy "risk read" on public.risk_factors for select to authenticated using (has_any_role(auth.uid()));
create policy "risk write" on public.risk_factors for all to authenticated using (can_write(auth.uid())) with check (can_write(auth.uid()));
create index risk_factors_case_idx on public.risk_factors (case_id);

create trigger verification_sessions_touch before update on public.verification_sessions for each row execute function public.touch_updated_at();
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();
create trigger selfies_touch before update on public.selfies for each row execute function public.touch_updated_at();
