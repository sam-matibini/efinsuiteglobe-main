CREATE TABLE IF NOT EXISTS public.api_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  endpoint text NOT NULL,
  status_code integer NOT NULL DEFAULT 200,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, idempotency_key)
);

GRANT ALL ON public.api_idempotency TO service_role;
ALTER TABLE public.api_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own idempotency records"
ON public.api_idempotency FOR SELECT TO authenticated
USING (public.is_org_member(org_id));

ALTER TABLE public.verification_sessions
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS redirect_url text,
  ADD COLUMN IF NOT EXISTS used_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS verification_sessions_token_hash_key
  ON public.verification_sessions (token_hash) WHERE token_hash IS NOT NULL;