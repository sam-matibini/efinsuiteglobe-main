create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

alter table public.app_settings
  add column if not exists cron_secret text not null default encode(gen_random_bytes(24), 'hex');

revoke select (cron_secret) on public.app_settings from anon, authenticated;

select cron.schedule(
  'eterfaceid-refresh-watchlists',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://project--23711572-6b83-4227-93a3-0820956fab3b.lovable.app/api/public/hooks/refresh-watchlists',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select cron_secret from public.app_settings limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'eterfaceid-rescreen',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://project--23711572-6b83-4227-93a3-0820956fab3b.lovable.app/api/public/hooks/rescreen',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select cron_secret from public.app_settings limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);