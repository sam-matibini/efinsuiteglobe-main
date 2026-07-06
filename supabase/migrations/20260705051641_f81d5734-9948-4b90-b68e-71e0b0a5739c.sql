
-- 1) Clear mis-mapped depreciation expense accounts (data fix)
UPDATE public.leases
SET depreciation_expense_account_id = NULL
WHERE depreciation_expense_account_id IS NOT NULL
  AND depreciation_expense_account_id = accumulated_depreciation_account_id;

-- 2) RPC: rebuild amortization schedule using effective-interest method.
-- Only rewrites rows that have not been posted (journal_entry_id IS NULL AND status <> 'posted').
CREATE OR REPLACE FUNCTION public.rebuild_lease_amortization_schedule(p_lease_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lease            public.leases%ROWTYPE;
  v_org_id           uuid;
  v_pv               numeric;
  v_pmt              numeric;
  v_n                integer;
  v_lo               numeric := 0.0000001;
  v_hi               numeric := 1.0; -- 100% monthly, generous ceiling
  v_mid              numeric;
  v_calc_pv          numeric;
  v_r                numeric;
  v_iter             integer := 0;
  v_opening          numeric;
  v_interest         numeric;
  v_principal        numeric;
  v_closing          numeric;
  v_depr_per_period  numeric;
  v_first_date       date;
  v_frequency_months integer := 1;
  v_period           integer;
  v_dt               date;
  v_rewritten        integer := 0;
  v_skipped          integer := 0;
  v_row              record;
  v_rou_opening      numeric;
  v_rou_closing      numeric;
BEGIN
  SELECT * INTO v_lease FROM public.leases WHERE id = p_lease_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lease % not found', p_lease_id;
  END IF;
  v_org_id := v_lease.organization_id;

  -- Authorization: caller must be a member of the org
  IF NOT public.is_org_member(v_org_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized for organization %', v_org_id;
  END IF;

  v_pv  := COALESCE(v_lease.present_value_payments, v_lease.lease_liability_initial);
  v_pmt := v_lease.payment_amount;
  v_n   := v_lease.term_months;
  v_first_date := COALESCE(v_lease.first_payment_date, v_lease.commencement_date);

  IF v_pv IS NULL OR v_pmt IS NULL OR v_n IS NULL OR v_n <= 0 OR v_pmt <= 0 OR v_pv <= 0 THEN
    RAISE EXCEPTION 'Lease missing PV / payment / term to rebuild schedule';
  END IF;

  -- Frequency step (months per payment)
  v_frequency_months := CASE lower(coalesce(v_lease.payment_frequency,'monthly'))
    WHEN 'monthly'     THEN 1
    WHEN 'quarterly'   THEN 3
    WHEN 'semi-annual' THEN 6
    WHEN 'semiannual'  THEN 6
    WHEN 'annual'      THEN 12
    WHEN 'yearly'      THEN 12
    ELSE 1
  END;

  -- Solve for periodic rate r such that PV = PMT * (1 - (1+r)^-n) / r via bisection.
  -- If PMT*n <= PV, there is effectively no interest.
  IF v_pmt * v_n <= v_pv + 0.005 THEN
    v_r := 0;
  ELSE
    WHILE v_iter < 200 LOOP
      v_mid := (v_lo + v_hi) / 2.0;
      v_calc_pv := v_pmt * (1 - power(1 + v_mid, -v_n)) / v_mid;
      IF v_calc_pv > v_pv THEN
        v_lo := v_mid;
      ELSE
        v_hi := v_mid;
      END IF;
      EXIT WHEN abs(v_calc_pv - v_pv) < 0.001;
      v_iter := v_iter + 1;
    END LOOP;
    v_r := v_mid;
  END IF;

  v_depr_per_period := round( COALESCE(v_lease.rou_asset_initial, v_pv)::numeric / v_n, 2 );

  -- Delete unposted schedule rows; keep posted ones intact
  DELETE FROM public.lease_payment_schedule
  WHERE lease_id = p_lease_id
    AND journal_entry_id IS NULL
    AND coalesce(status,'scheduled') <> 'posted';

  -- Build fresh schedule starting from current liability position of any surviving posted rows,
  -- else from full PV.
  SELECT COALESCE(MAX(payment_number), 0), COALESCE(MIN(closing_liability), v_pv)
  INTO v_period, v_opening
  FROM public.lease_payment_schedule
  WHERE lease_id = p_lease_id;

  IF v_period = 0 THEN
    v_opening := v_pv;
  ELSE
    SELECT closing_liability, rou_asset_closing
    INTO v_opening, v_rou_opening
    FROM public.lease_payment_schedule
    WHERE lease_id = p_lease_id AND payment_number = v_period;
  END IF;

  v_rou_opening := COALESCE(v_rou_opening, v_lease.rou_asset_initial, v_pv);

  FOR i IN (v_period + 1)..v_n LOOP
    v_dt := (v_first_date + ((i - 1) * v_frequency_months) * INTERVAL '1 month')::date;
    v_interest  := round(v_opening * v_r, 2);
    v_principal := round(v_pmt - v_interest, 2);
    -- Last payment: absorb rounding
    IF i = v_n THEN
      v_principal := round(v_opening, 2);
      v_interest  := round(v_pmt - v_principal, 2);
    END IF;
    v_closing := round(v_opening - v_principal, 2);

    v_rou_closing := round(v_rou_opening - v_depr_per_period, 2);
    IF i = v_n THEN
      v_depr_per_period := v_rou_opening; -- absorb ROU rounding on last period
      v_rou_closing := 0;
    END IF;

    INSERT INTO public.lease_payment_schedule (
      lease_id, payment_number, payment_date, payment_amount,
      principal_amount, interest_amount, opening_liability, closing_liability,
      depreciation_amount, rou_asset_opening, rou_asset_closing, status
    ) VALUES (
      p_lease_id, i, v_dt, v_pmt,
      v_principal, v_interest, v_opening, v_closing,
      v_depr_per_period, v_rou_opening, v_rou_closing, 'scheduled'
    );

    v_opening := v_closing;
    v_rou_opening := v_rou_closing;
    v_rewritten := v_rewritten + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'lease_id', p_lease_id,
    'periodic_rate', v_r,
    'apr_estimate', v_r * (12.0 / v_frequency_months),
    'rows_written', v_rewritten,
    'rows_skipped_posted', v_skipped,
    'first_payment', v_first_date,
    'term_months', v_n
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_lease_amortization_schedule(uuid) TO authenticated;

-- 3) RPC: reclassify bank-feed postings that debited the lease liability directly.
-- For every posted JE line on the lease's liability account whose parent JE reference starts with 'BANK-'
-- and has NOT already been reclassified (idempotency key: notes tag 'LEASE-RECLASS:<lease_id>'),
-- post a balanced reversal JE that flips the liability line and books the offset to p_clearing_account_id.
CREATE OR REPLACE FUNCTION public.reclassify_lease_bank_postings(
  p_lease_id uuid,
  p_clearing_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lease   public.leases%ROWTYPE;
  v_org_id  uuid;
  v_liab_id uuid;
  v_tag     text;
  v_created integer := 0;
  v_je_id   uuid;
  r         record;
BEGIN
  SELECT * INTO v_lease FROM public.leases WHERE id = p_lease_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lease % not found', p_lease_id; END IF;
  v_org_id := v_lease.organization_id;
  v_liab_id := v_lease.lease_liability_account_id;
  IF v_liab_id IS NULL THEN RAISE EXCEPTION 'Lease has no liability account'; END IF;
  IF NOT public.is_org_member(v_org_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized for organization %', v_org_id;
  END IF;
  IF p_clearing_account_id IS NULL THEN
    RAISE EXCEPTION 'Clearing account required';
  END IF;

  v_tag := 'LEASE-RECLASS:' || p_lease_id::text;

  FOR r IN
    SELECT je.id AS je_id, je.entry_date, je.reference, je.description,
           jel.debit, jel.credit
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = v_liab_id
      AND je.status = 'posted'
      AND je.organization_id = v_org_id
      AND je.reference LIKE 'BANK-%'
      AND NOT EXISTS (
        SELECT 1 FROM public.journal_entries je2
        WHERE je2.organization_id = v_org_id
          AND je2.notes = v_tag || '|src:' || je.id::text
      )
  LOOP
    INSERT INTO public.journal_entries (
      organization_id, entry_date, reference, description, status, journal_type, notes, created_by, posted_by, posted_at
    ) VALUES (
      v_org_id, r.entry_date,
      'LEASE-RECLASS-' || substr(replace(r.je_id::text, '-', ''), 1, 12),
      'Reclassify bank posting off lease liability: ' || coalesce(r.description,''),
      'posted', 'manual', v_tag || '|src:' || r.je_id::text,
      auth.uid(), auth.uid(), now()
    ) RETURNING id INTO v_je_id;

    -- Flip the original liability leg
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je_id, v_liab_id, r.credit, r.debit, 'Reverse bank posting on lease liability');
    -- Offset to clearing (opposite side)
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_je_id, p_clearing_account_id, r.debit, r.credit, 'Lease payment clearing');

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('lease_id', p_lease_id, 'reclassified_count', v_created);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reclassify_lease_bank_postings(uuid, uuid) TO authenticated;
