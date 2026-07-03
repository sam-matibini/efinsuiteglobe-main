-- ============================================
-- ENHANCED VOICE BILLING & ACCOUNTING INTEGRATION
-- ============================================

-- Add journal_entry_id to wallet transactions for GL integration
ALTER TABLE public.voice_wallet_transactions
ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES public.journal_entries(id);

-- Add margin and provider cost tracking to sessions
ALTER TABLE public.voice_call_sessions
ADD COLUMN IF NOT EXISTS provider_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS margin_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_increment_seconds INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS exchange_rate_locked NUMERIC DEFAULT 1;

-- ============================================
-- ENHANCED BILLING FUNCTION with proper formula
-- charge = ceil(duration_seconds / billing_increment) × rate_per_minute / 60
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_voice_call_cost(
  p_duration_seconds INTEGER,
  p_rate_per_minute NUMERIC,
  p_billing_increment_seconds INTEGER DEFAULT 60,
  p_connection_fee NUMERIC DEFAULT 0
)
RETURNS TABLE (
  billable_seconds INTEGER,
  billable_units INTEGER,
  base_cost NUMERIC,
  connection_fee NUMERIC,
  total_cost NUMERIC
)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_billing_increment INTEGER;
  v_billable_units INTEGER;
  v_base_cost NUMERIC;
BEGIN
  -- Use 1 second as minimum increment for per-second billing
  v_billing_increment := GREATEST(p_billing_increment_seconds, 1);
  
  -- Calculate billable units: ceil(duration / increment)
  v_billable_units := CEIL(p_duration_seconds::NUMERIC / v_billing_increment);
  
  -- Calculate billable seconds
  billable_seconds := v_billable_units * v_billing_increment;
  billable_units := v_billable_units;
  
  -- Calculate cost: (billable_seconds / 60) * rate_per_minute
  v_base_cost := ROUND((billable_seconds::NUMERIC / 60) * p_rate_per_minute, 4);
  base_cost := v_base_cost;
  connection_fee := COALESCE(p_connection_fee, 0);
  total_cost := ROUND(v_base_cost + COALESCE(p_connection_fee, 0), 4);
  
  RETURN NEXT;
END;
$$;

-- ============================================
-- ENHANCED FINALIZE BILLING with Accounting Integration
-- Posts Journal Entry: DR Communication Expense, CR Voice Wallet Asset
-- ============================================
CREATE OR REPLACE FUNCTION public.finalize_voice_billing_with_accounting(
  p_session_id UUID,
  p_duration_seconds INTEGER,
  p_create_journal_entry BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  final_cost NUMERIC,
  billable_seconds INTEGER,
  journal_entry_id UUID
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session RECORD;
  v_rate RECORD;
  v_reserve_tx RECORD;
  v_cost_calc RECORD;
  v_difference NUMERIC;
  v_final_cost NUMERIC;
  v_billable_seconds INTEGER;
  v_journal_id UUID;
  v_expense_account_id UUID;
  v_wallet_account_id UUID;
  v_user_id UUID;
BEGIN
  -- Get session details with rate info
  SELECT 
    vcs.*,
    vcr.billing_increment_seconds,
    vcr.connection_fee
  INTO v_session
  FROM public.voice_call_sessions vcs
  LEFT JOIN public.voice_call_rates vcr ON vcr.country_code = vcs.destination_country_code
    AND vcr.is_active = true
  WHERE vcs.id = p_session_id;
  
  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  -- Calculate final cost using proper formula
  SELECT * INTO v_cost_calc
  FROM public.calculate_voice_call_cost(
    p_duration_seconds,
    v_session.rate_applied,
    COALESCE(v_session.billing_increment_seconds, v_session.billing_increment_seconds, 60),
    0  -- connection fee if applicable
  );
  
  v_final_cost := v_cost_calc.total_cost;
  v_billable_seconds := v_cost_calc.billable_seconds;
  
  -- Get reserve transaction
  SELECT * INTO v_reserve_tx
  FROM public.voice_wallet_transactions
  WHERE session_id = p_session_id
    AND transaction_type = 'reserve'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_reserve_tx IS NOT NULL THEN
    v_difference := v_reserve_tx.amount - v_final_cost;
    
    -- Release unused reserve if any
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
    -- If actual cost exceeded reserve (edge case), deduct additional
    ELSIF v_difference < 0 THEN
      UPDATE public.voice_wallets
      SET balance = balance + v_difference, -- v_difference is negative, so this deducts
          updated_at = now()
      WHERE id = v_reserve_tx.wallet_id;
      
      INSERT INTO public.voice_wallet_transactions (
        wallet_id, session_id, transaction_type, amount, currency, description
      ) VALUES (
        v_reserve_tx.wallet_id, p_session_id, 'deduct', ABS(v_difference), v_reserve_tx.currency,
        'Additional charge beyond estimate'
      );
    END IF;
  END IF;
  
  -- Update session with final billing details
  UPDATE public.voice_call_sessions
  SET final_cost = v_final_cost,
      billable_seconds = v_billable_seconds,
      duration_seconds = p_duration_seconds,
      updated_at = now()
  WHERE id = p_session_id;
  
  -- Create accounting journal entry if requested and cost > 0
  IF p_create_journal_entry AND v_final_cost > 0 THEN
    -- Find Communication Expense account (or create placeholder ID)
    SELECT id INTO v_expense_account_id
    FROM public.accounts
    WHERE organization_id = v_session.organization_id
      AND (
        name ILIKE '%communication expense%' 
        OR name ILIKE '%telephone expense%'
        OR name ILIKE '%telecom%'
        OR (account_type = 'expense' AND code LIKE '6%')
      )
      AND is_header = false
    ORDER BY 
      CASE WHEN name ILIKE '%communication%' THEN 1 ELSE 2 END
    LIMIT 1;
    
    -- Find Voice Wallet / Prepaid Asset account
    SELECT id INTO v_wallet_account_id
    FROM public.accounts
    WHERE organization_id = v_session.organization_id
      AND (
        name ILIKE '%prepaid%'
        OR name ILIKE '%voice wallet%'
        OR name ILIKE '%communication credit%'
        OR (account_type = 'asset' AND name ILIKE '%communication%')
      )
      AND is_header = false
    ORDER BY 
      CASE WHEN name ILIKE '%voice%' OR name ILIKE '%prepaid%' THEN 1 ELSE 2 END
    LIMIT 1;
    
    -- Only create journal entry if both accounts exist
    IF v_expense_account_id IS NOT NULL AND v_wallet_account_id IS NOT NULL THEN
      -- Create journal entry
      INSERT INTO public.journal_entries (
        organization_id,
        entry_date,
        reference,
        description,
        journal_type,
        status,
        created_by
      ) VALUES (
        v_session.organization_id,
        CURRENT_DATE,
        'VOICE-' || SUBSTRING(p_session_id::TEXT, 1, 8),
        'Voice call to ' || v_session.destination_number || ' (' || v_billable_seconds || 's)',
        'adjustment',
        'posted',
        v_session.user_id
      )
      RETURNING id INTO v_journal_id;
      
      -- Debit: Communication Expense (increases expense)
      INSERT INTO public.journal_entry_lines (
        journal_entry_id,
        account_id,
        debit,
        credit,
        description
      ) VALUES (
        v_journal_id,
        v_expense_account_id,
        v_final_cost,
        0,
        'Voice call expense - ' || v_session.destination_country_code
      );
      
      -- Credit: Voice Wallet / Prepaid Asset (decreases asset)
      INSERT INTO public.journal_entry_lines (
        journal_entry_id,
        account_id,
        debit,
        credit,
        description
      ) VALUES (
        v_journal_id,
        v_wallet_account_id,
        0,
        v_final_cost,
        'Voice wallet usage - Session ' || SUBSTRING(p_session_id::TEXT, 1, 8)
      );
      
      -- Link journal entry to wallet transaction
      UPDATE public.voice_wallet_transactions
      SET journal_entry_id = v_journal_id
      WHERE session_id = p_session_id
        AND transaction_type = 'reserve';
    END IF;
  END IF;
  
  -- Return results
  final_cost := v_final_cost;
  billable_seconds := v_billable_seconds;
  journal_entry_id := v_journal_id;
  RETURN NEXT;
END;
$$;

-- ============================================
-- WALLET TOP-UP with Accounting (Credit Wallet Asset, Debit Cash/Bank)
-- ============================================
CREATE OR REPLACE FUNCTION public.topup_voice_wallet_with_accounting(
  p_organization_id UUID,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD',
  p_payment_account_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  wallet_id UUID,
  new_balance NUMERIC,
  transaction_id UUID,
  journal_entry_id UUID
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet_id UUID;
  v_new_balance NUMERIC;
  v_tx_id UUID;
  v_journal_id UUID;
  v_wallet_account_id UUID;
BEGIN
  -- Get or create wallet
  SELECT id INTO v_wallet_id
  FROM public.voice_wallets
  WHERE organization_id = p_organization_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.voice_wallets (organization_id, balance, currency)
    VALUES (p_organization_id, 0, p_currency)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Update wallet balance
  UPDATE public.voice_wallets
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;
  
  -- Record transaction
  INSERT INTO public.voice_wallet_transactions (
    wallet_id, transaction_type, amount, currency, description, status, created_by
  ) VALUES (
    v_wallet_id, 'topup', p_amount, p_currency, 'Wallet top-up', 'completed', p_user_id
  )
  RETURNING id INTO v_tx_id;
  
  -- Create accounting entry if payment account provided
  IF p_payment_account_id IS NOT NULL THEN
    -- Find Voice Wallet Asset account
    SELECT id INTO v_wallet_account_id
    FROM public.accounts
    WHERE organization_id = p_organization_id
      AND (
        name ILIKE '%prepaid%'
        OR name ILIKE '%voice wallet%'
        OR name ILIKE '%communication credit%'
      )
      AND is_header = false
    LIMIT 1;
    
    IF v_wallet_account_id IS NOT NULL THEN
      -- Create journal entry
      INSERT INTO public.journal_entries (
        organization_id,
        entry_date,
        reference,
        description,
        journal_type,
        status,
        created_by
      ) VALUES (
        p_organization_id,
        CURRENT_DATE,
        'VOICE-TOPUP-' || SUBSTRING(v_tx_id::TEXT, 1, 8),
        'Voice wallet top-up ' || p_amount || ' ' || p_currency,
        'adjustment',
        'posted',
        p_user_id
      )
      RETURNING id INTO v_journal_id;
      
      -- Debit: Voice Wallet Asset (increase prepaid)
      INSERT INTO public.journal_entry_lines (
        journal_entry_id, account_id, debit, credit, description
      ) VALUES (
        v_journal_id, v_wallet_account_id, p_amount, 0, 'Voice wallet top-up'
      );
      
      -- Credit: Cash/Bank account (decrease cash)
      INSERT INTO public.journal_entry_lines (
        journal_entry_id, account_id, debit, credit, description
      ) VALUES (
        v_journal_id, p_payment_account_id, 0, p_amount, 'Payment for voice credits'
      );
      
      -- Link to transaction
      UPDATE public.voice_wallet_transactions
      SET journal_entry_id = v_journal_id
      WHERE id = v_tx_id;
    END IF;
  END IF;
  
  wallet_id := v_wallet_id;
  new_balance := v_new_balance;
  transaction_id := v_tx_id;
  journal_entry_id := v_journal_id;
  RETURN NEXT;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_voice_call_cost TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_voice_billing_with_accounting TO authenticated;
GRANT EXECUTE ON FUNCTION public.topup_voice_wallet_with_accounting TO authenticated;