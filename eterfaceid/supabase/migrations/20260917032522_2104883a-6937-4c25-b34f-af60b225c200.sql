create table public.api_notepad (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  purpose text,
  status text not null default 'idea' check (status in ('idea','keys_needed','connecting','live')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.api_notepad to authenticated;
grant all on public.api_notepad to service_role;

alter table public.api_notepad enable row level security;

create policy "Staff can view API wish list"
  on public.api_notepad for select to authenticated
  using (public.is_platform_staff());

create policy "Staff can add API wish list entries"
  on public.api_notepad for insert to authenticated
  with check (public.is_platform_staff());

create policy "Staff can edit API wish list entries"
  on public.api_notepad for update to authenticated
  using (public.is_platform_staff()) with check (public.is_platform_staff());

create policy "Staff can delete API wish list entries"
  on public.api_notepad for delete to authenticated
  using (public.is_platform_staff());

create or replace function public.touch_api_notepad_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger api_notepad_updated_at
  before update on public.api_notepad
  for each row execute function public.touch_api_notepad_updated_at();