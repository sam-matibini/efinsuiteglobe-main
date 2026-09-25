-- =============================================
-- HYBRID VOICE CALLING INFRASTRUCTURE
-- Supports PSTN-to-PSTN bridging without internet
-- =============================================

-- Voice Provider Registry
CREATE TABLE public.voice_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('primary', 'secondary', 'failover')),
  api_base_url TEXT,
  supports_bridging BOOLEAN DEFAULT true,
  supports_recording BOOLEAN DEFAULT true,
  billing_increment_seconds INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Country-Provider Routing Configuration
CREATE TABLE public.voice_provider_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  region TEXT CHECK (region IN ('north_america', 'europe', 'africa', 'asia', 'oceania', 'south_america')),
  primary_provider_id UUID REFERENCES public.voice_providers(id),
  secondary_provider_id UUID REFERENCES public.voice_providers(id),
  failover_provider_id UUID REFERENCES public.voice_providers(id),
  routing_strategy TEXT DEFAULT 'cost' CHECK (routing_strategy IN ('cost', 'quality', 'balanced')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_code)
);

-- Call Rate Cards
CREATE TABLE public.voice_call_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES public.voice_providers(id) NOT NULL,
  country_code TEXT NOT NULL,
  rate_per_minute NUMERIC(10,6) NOT NULL,
  billing_increment_seconds INTEGER DEFAULT 60,
  connection_fee NUMERIC(10,4) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization Voice Wallets
CREATE TABLE public.voice_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  balance NUMERIC(12,4) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  low_balance_threshold NUMERIC(12,4) DEFAULT 10,
  auto_recharge_enabled BOOLEAN DEFAULT false,
  auto_recharge_amount NUMERIC(12,4),
  auto_recharge_trigger NUMERIC(12,4),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- Wallet Transactions (credits, debits, reserves)
CREATE TABLE public.voice_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.voice_wallets(id) NOT NULL,
  session_id UUID,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'reserve', 'release', 'adjustment')),
  amount NUMERIC(12,4) NOT NULL,
  currency TEXT DEFAULT 'USD',
  exchange_rate NUMERIC(12,6) DEFAULT 1,
  base_amount NUMERIC(12,4),
  description TEXT,
  reference TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Call Sessions (the core call tracking table)
CREATE TABLE public.voice_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  user_id UUID,
  
  -- Call endpoints
  source_number TEXT NOT NULL,
  destination_number TEXT NOT NULL,
  source_country_code TEXT,
  destination_country_code TEXT,
  
  -- Provider tracking
  leg_a_provider_id UUID REFERENCES public.voice_providers(id),
  leg_b_provider_id UUID REFERENCES public.voice_providers(id),
  leg_a_call_sid TEXT,
  leg_b_call_sid TEXT,
  conference_sid TEXT,
  
  -- Call status
  call_status TEXT DEFAULT 'initiated' CHECK (call_status IN (
    'initiated', 'leg_a_ringing', 'leg_a_answered', 'leg_a_failed',
    'leg_b_ringing', 'leg_b_answered', 'leg_b_failed',
    'bridged', 'completed', 'failed', 'cancelled', 'no_answer', 'busy'
  )),
  
  -- Timing
  initiated_at TIMESTAMPTZ DEFAULT now(),
  leg_a_answered_at TIMESTAMPTZ,
  leg_b_answered_at TIMESTAMPTZ,
  bridged_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  billable_seconds INTEGER DEFAULT 0,
  
  -- Billing
  estimated_cost NUMERIC(10,4),
  final_cost NUMERIC(10,4),
  rate_applied NUMERIC(10,6),
  currency TEXT DEFAULT 'USD',
  wallet_transaction_id UUID REFERENCES public.voice_wallet_transactions(id),
  
  -- Recording
  recording_enabled BOOLEAN DEFAULT false,
  recording_sid TEXT,
  recording_url TEXT,
  
  -- Metadata
  call_direction TEXT DEFAULT 'outbound' CHECK (call_direction IN ('inbound', 'outbound')),
  failover_attempts INTEGER DEFAULT 0,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Call Events Log (detailed audit trail)
CREATE TABLE public.voice_call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.voice_call_sessions(id) NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  provider_id UUID REFERENCES public.voice_providers(id),
  provider_event_id TEXT,
  occurred_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_provider_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_call_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_call_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for voice_providers (admin read-only for regular users)
CREATE POLICY "voice_providers_select" ON public.voice_providers
  FOR SELECT USING (true);

CREATE POLICY "voice_provider_routes_select" ON public.voice_provider_routes
  FOR SELECT USING (true);

CREATE POLICY "voice_call_rates_select" ON public.voice_call_rates
  FOR SELECT USING (true);

-- RLS for wallets (org member access)
CREATE POLICY "voice_wallets_select" ON public.voice_wallets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.organization_members 
            WHERE organization_id = voice_wallets.organization_id 
            AND user_id = auth.uid())
  );

CREATE POLICY "voice_wallets_update" ON public.voice_wallets
  FOR UPDATE USING (
    public.is_org_admin_or_owner(organization_id, auth.uid())
  );

-- RLS for wallet transactions
CREATE POLICY "voice_wallet_transactions_select" ON public.voice_wallet_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.voice_wallets w
      JOIN public.organization_members om ON om.organization_id = w.organization_id
      WHERE w.id = voice_wallet_transactions.wallet_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS for call sessions
CREATE POLICY "voice_call_sessions_select" ON public.voice_call_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.organization_members 
            WHERE organization_id = voice_call_sessions.organization_id 
            AND user_id = auth.uid())
  );

CREATE POLICY "voice_call_sessions_insert" ON public.voice_call_sessions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_members 
            WHERE organization_id = voice_call_sessions.organization_id 
            AND user_id = auth.uid())
  );

-- RLS for call events
CREATE POLICY "voice_call_events_select" ON public.voice_call_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.voice_call_sessions s
      JOIN public.organization_members om ON om.organization_id = s.organization_id
      WHERE s.id = voice_call_events.session_id
      AND om.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_voice_call_sessions_org ON public.voice_call_sessions(organization_id);
CREATE INDEX idx_voice_call_sessions_status ON public.voice_call_sessions(call_status);
CREATE INDEX idx_voice_call_sessions_initiated ON public.voice_call_sessions(initiated_at);
CREATE INDEX idx_voice_call_rates_lookup ON public.voice_call_rates(provider_id, country_code, is_active);
CREATE INDEX idx_voice_wallet_transactions_wallet ON public.voice_wallet_transactions(wallet_id);
CREATE INDEX idx_voice_call_events_session ON public.voice_call_events(session_id);

-- Seed default providers
INSERT INTO public.voice_providers (code, name, provider_type, priority) VALUES
  ('twilio', 'Twilio', 'primary', 10),
  ('telnyx', 'Telnyx', 'primary', 20),
  ('africas_talking', 'Africas Talking', 'primary', 30),
  ('infobip', 'Infobip', 'secondary', 40),
  ('plivo', 'Plivo', 'failover', 50),
  ('wavecell', 'Wavecell', 'secondary', 60),
  ('termii', 'Termii', 'secondary', 70);

-- Seed default routing rules
INSERT INTO public.voice_provider_routes (country_code, country_name, region, primary_provider_id, secondary_provider_id, failover_provider_id)
SELECT 'CA', 'Canada', 'north_america', 
  (SELECT id FROM public.voice_providers WHERE code = 'twilio'),
  (SELECT id FROM public.voice_providers WHERE code = 'telnyx'),
  (SELECT id FROM public.voice_providers WHERE code = 'plivo');

INSERT INTO public.voice_provider_routes (country_code, country_name, region, primary_provider_id, secondary_provider_id, failover_provider_id)
SELECT 'US', 'United States', 'north_america',
  (SELECT id FROM public.voice_providers WHERE code = 'twilio'),
  (SELECT id FROM public.voice_providers WHERE code = 'telnyx'),
  (SELECT id FROM public.voice_providers WHERE code = 'plivo');

INSERT INTO public.voice_provider_routes (country_code, country_name, region, primary_provider_id, secondary_provider_id, failover_provider_id)
SELECT 'NG', 'Nigeria', 'africa',
  (SELECT id FROM public.voice_providers WHERE code = 'africas_talking'),
  (SELECT id FROM public.voice_providers WHERE code = 'termii'),
  (SELECT id FROM public.voice_providers WHERE code = 'infobip');

INSERT INTO public.voice_provider_routes (country_code, country_name, region, primary_provider_id, secondary_provider_id, failover_provider_id)
SELECT 'KE', 'Kenya', 'africa',
  (SELECT id FROM public.voice_providers WHERE code = 'africas_talking'),
  (SELECT id FROM public.voice_providers WHERE code = 'wavecell'),
  (SELECT id FROM public.voice_providers WHERE code = 'infobip');

INSERT INTO public.voice_provider_routes (country_code, country_name, region, primary_provider_id, secondary_provider_id, failover_provider_id)
SELECT 'ZA', 'South Africa', 'africa',
  (SELECT id FROM public.voice_providers WHERE code = 'africas_talking'),
  (SELECT id FROM public.voice_providers WHERE code = 'infobip'),
  (SELECT id FROM public.voice_providers WHERE code = 'plivo');

INSERT INTO public.voice_provider_routes (country_code, country_name, region, primary_provider_id, secondary_provider_id, failover_provider_id)
SELECT 'GB', 'United Kingdom', 'europe',
  (SELECT id FROM public.voice_providers WHERE code = 'twilio'),
  (SELECT id FROM public.voice_providers WHERE code = 'infobip'),
  (SELECT id FROM public.voice_providers WHERE code = 'plivo');

INSERT INTO public.voice_provider_routes (country_code, country_name, region, primary_provider_id, secondary_provider_id, failover_provider_id)
SELECT 'DE', 'Germany', 'europe',
  (SELECT id FROM public.voice_providers WHERE code = 'twilio'),
  (SELECT id FROM public.voice_providers WHERE code = 'infobip'),
  (SELECT id FROM public.voice_providers WHERE code = 'plivo');

-- Seed sample rates (Twilio baseline)
INSERT INTO public.voice_call_rates (provider_id, country_code, rate_per_minute, billing_increment_seconds, currency)
SELECT 
  (SELECT id FROM public.voice_providers WHERE code = 'twilio'),
  country_code,
  CASE 
    WHEN country_code IN ('US', 'CA') THEN 0.014
    WHEN country_code IN ('GB', 'DE') THEN 0.035
    WHEN country_code IN ('NG', 'KE', 'ZA') THEN 0.15
    ELSE 0.05
  END,
  60,
  'USD'
FROM (VALUES ('US'), ('CA'), ('GB'), ('DE'), ('NG'), ('KE'), ('ZA')) AS c(country_code);

-- Africa's Talking rates (cheaper for Africa)
INSERT INTO public.voice_call_rates (provider_id, country_code, rate_per_minute, billing_increment_seconds, currency)
SELECT 
  (SELECT id FROM public.voice_providers WHERE code = 'africas_talking'),
  country_code,
  CASE 
    WHEN country_code = 'NG' THEN 0.08
    WHEN country_code = 'KE' THEN 0.06
    WHEN country_code = 'ZA' THEN 0.10
    ELSE 0.12
  END,
  1, -- Per-second billing
  'USD'
FROM (VALUES ('NG'), ('KE'), ('ZA')) AS c(country_code);

-- Function to get best rate for a destination
CREATE OR REPLACE FUNCTION public.get_best_voice_rate(
  p_destination_country TEXT,
  p_routing_strategy TEXT DEFAULT 'cost'
)
RETURNS TABLE (
  provider_id UUID,
  provider_code TEXT,
  rate_per_minute NUMERIC,
  billing_increment_seconds INTEGER,
  currency TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.provider_id,
    p.code,
    r.rate_per_minute,
    r.billing_increment_seconds,
    r.currency
  FROM public.voice_call_rates r
  JOIN public.voice_providers p ON p.id = r.provider_id
  WHERE r.country_code = p_destination_country
    AND r.is_active = true
    AND p.is_active = true
    AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
  ORDER BY 
    CASE WHEN p_routing_strategy = 'cost' THEN r.rate_per_minute END ASC,
    CASE WHEN p_routing_strategy = 'quality' THEN p.priority END ASC,
    r.rate_per_minute ASC
  LIMIT 1;
END;
$$;

-- Function to reserve wallet balance
CREATE OR REPLACE FUNCTION public.reserve_voice_wallet(
  p_organization_id UUID,
  p_session_id UUID,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet_id UUID;
  v_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Get wallet and check balance
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM public.voice_wallets
  WHERE organization_id = p_organization_id
  FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'No wallet found for organization';
  END IF;
  
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Required: %, Available: %', p_amount, v_balance;
  END IF;
  
  -- Reserve the amount
  UPDATE public.voice_wallets
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = v_wallet_id;
  
  -- Record transaction
  INSERT INTO public.voice_wallet_transactions (
    wallet_id, session_id, transaction_type, amount, currency, description, status
  ) VALUES (
    v_wallet_id, p_session_id, 'reserve', p_amount, p_currency,
    'Call reservation', 'completed'
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$;

-- Function to finalize call billing
CREATE OR REPLACE FUNCTION public.finalize_voice_billing(
  p_session_id UUID,
  p_final_cost NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session RECORD;
  v_reserve_tx RECORD;
  v_difference NUMERIC;
BEGIN
  -- Get session details
  SELECT * INTO v_session
  FROM public.voice_call_sessions
  WHERE id = p_session_id;
  
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- Get reserve transaction
  SELECT * INTO v_reserve_tx
  FROM public.voice_wallet_transactions
  WHERE session_id = p_session_id
    AND transaction_type = 'reserve'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_reserve_tx IS NOT NULL THEN
    v_difference := v_reserve_tx.amount - p_final_cost;
    
    -- Release unused reserve
    IF v_difference > 0 THEN
      UPDATE public.voice_wallets
      SET balance = balance + v_difference,
          updated_at = now()
      WHERE id = v_reserve_tx.wallet_id;
      
      INSERT INTO public.voice_wallet_transactions (
        wallet_id, session_id, transaction_type, amount, currency, description
      ) VALUES (
        v_reserve_tx.wallet_id, p_session_id, 'release', v_difference, v_reserve_tx.currency,
        'Unused reserve released'
      );
    END IF;
  END IF;
  
  -- Update session with final cost
  UPDATE public.voice_call_sessions
  SET final_cost = p_final_cost,
      updated_at = now()
  WHERE id = p_session_id;
END;
$$;