select cron.schedule(
  'eid-plaid-sync-daily',
  '0 5 * * *',
  $$
  select net.http_post(
    url := 'https://project--23711572-6b83-4227-93a3-0820956fab3b.lovable.app/api/public/hooks/plaid-sync',
    headers := jsonb_build_object('content-type','application/json','x-cron-secret', (select cron_secret from public.app_settings limit 1)),
    body := '{}'::jsonb
  );
  $$
);