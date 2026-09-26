create or replace function public.caller_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.organization_members where user_id = auth.uid() order by created_at limit 1
$$;
revoke execute on function public.caller_org_id() from public, anon;
grant execute on function public.caller_org_id() to authenticated, service_role;

create or replace function public.set_org_from_case()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null and new.case_id is not null then
    select c.org_id into new.org_id from public.cases c where c.id = new.case_id;
  end if;
  if new.org_id is null then
    new.org_id := public.caller_org_id();
  end if;
  if new.org_id is null then
    raise exception 'org_id could not be determined for %', tg_table_name;
  end if;
  return new;
end;
$$;

create or replace function public.set_org_from_caller()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null then
    new.org_id := public.caller_org_id();
  end if;
  if new.org_id is null then
    raise exception 'org_id could not be determined for %', tg_table_name;
  end if;
  return new;
end;
$$;

create or replace function public.set_org_from_endpoint()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null then
    select e.org_id into new.org_id from public.webhook_endpoints e where e.id = new.endpoint_id;
  end if;
  if new.org_id is null then
    raise exception 'org_id could not be determined for webhook_deliveries';
  end if;
  return new;
end;
$$;

revoke execute on function public.set_org_from_case() from public, anon, authenticated;
revoke execute on function public.set_org_from_caller() from public, anon, authenticated;
revoke execute on function public.set_org_from_endpoint() from public, anon, authenticated;

create trigger set_org before insert on public.case_checks for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.case_addresses for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.business_owners for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.screening_runs for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.screening_hits for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.monitoring_alerts for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.documents for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.selfies for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.verification_sessions for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.device_signals for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.risk_factors for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.transactions for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.transaction_alerts for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.regulatory_reports for each row execute function public.set_org_from_case();
create trigger set_org before insert on public.cases for each row execute function public.set_org_from_caller();
create trigger set_org before insert on public.api_keys for each row execute function public.set_org_from_caller();
create trigger set_org before insert on public.webhook_endpoints for each row execute function public.set_org_from_caller();
create trigger set_org before insert on public.audit_events for each row execute function public.set_org_from_caller();
create trigger set_org before insert on public.webhook_deliveries for each row execute function public.set_org_from_endpoint();