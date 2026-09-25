CREATE OR REPLACE FUNCTION public.generate_tax_filing_periods(p_organization_id uuid, p_tax_authority_id uuid, p_year integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_frequency text;
  v_period_start date;
  v_period_end date;
  v_due_date date;
  v_count integer := 0;
  v_month integer;
  v_quarter integer;
BEGIN
  IF NOT public.is_org_member(auth.uid(), p_organization_id) THEN
    RAISE EXCEPTION 'Not authorized for this organization';
  END IF;

  SELECT filing_frequency INTO v_frequency
  FROM public.tax_authorities
  WHERE id = p_tax_authority_id AND organization_id = p_organization_id;

  IF v_frequency IS NULL THEN
    RAISE EXCEPTION 'Tax authority not found';
  END IF;

  IF v_frequency = 'monthly' THEN
    FOR v_month IN 1..12 LOOP
      v_period_start := make_date(p_year, v_month, 1);
      v_period_end := (v_period_start + interval '1 month' - interval '1 day')::date;
      v_due_date := (v_period_end + interval '1 month')::date;
      INSERT INTO public.tax_filing_periods (organization_id, tax_authority_id, period_start, period_end, due_date, status)
      VALUES (p_organization_id, p_tax_authority_id, v_period_start, v_period_end, v_due_date, 'open')
      ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END LOOP;
  ELSIF v_frequency = 'quarterly' THEN
    FOR v_quarter IN 1..4 LOOP
      v_period_start := make_date(p_year, ((v_quarter - 1) * 3) + 1, 1);
      v_period_end := (v_period_start + interval '3 months' - interval '1 day')::date;
      v_due_date := (v_period_end + interval '1 month')::date;
      INSERT INTO public.tax_filing_periods (organization_id, tax_authority_id, period_start, period_end, due_date, status)
      VALUES (p_organization_id, p_tax_authority_id, v_period_start, v_period_end, v_due_date, 'open')
      ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END LOOP;
  ELSIF v_frequency = 'semi_annually' THEN
    v_period_start := make_date(p_year, 1, 1);
    v_period_end := make_date(p_year, 6, 30);
    v_due_date := (v_period_end + interval '1 month')::date;
    INSERT INTO public.tax_filing_periods (organization_id, tax_authority_id, period_start, period_end, due_date, status)
    VALUES (p_organization_id, p_tax_authority_id, v_period_start, v_period_end, v_due_date, 'open')
    ON CONFLICT DO NOTHING;
    v_period_start := make_date(p_year, 7, 1);
    v_period_end := make_date(p_year, 12, 31);
    v_due_date := (v_period_end + interval '1 month')::date;
    INSERT INTO public.tax_filing_periods (organization_id, tax_authority_id, period_start, period_end, due_date, status)
    VALUES (p_organization_id, p_tax_authority_id, v_period_start, v_period_end, v_due_date, 'open')
    ON CONFLICT DO NOTHING;
    v_count := 2;
  ELSE
    v_period_start := make_date(p_year, 1, 1);
    v_period_end := make_date(p_year, 12, 31);
    v_due_date := (v_period_end + interval '3 months')::date;
    INSERT INTO public.tax_filing_periods (organization_id, tax_authority_id, period_start, period_end, due_date, status)
    VALUES (p_organization_id, p_tax_authority_id, v_period_start, v_period_end, v_due_date, 'open')
    ON CONFLICT DO NOTHING;
    v_count := 1;
  END IF;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.lock_tax_filing_period(p_filing_period_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_period public.tax_filing_periods%ROWTYPE;
  v_lock_id uuid;
BEGIN
  SELECT * INTO v_period FROM public.tax_filing_periods WHERE id = p_filing_period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Filing period not found'; END IF;
  IF NOT public.is_org_member(auth.uid(), v_period.organization_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.tax_period_locks (organization_id, tax_authority_id, filing_period_id, lock_start, lock_end, locked_by)
  VALUES (v_period.organization_id, v_period.tax_authority_id, v_period.id, v_period.period_start, v_period.period_end, auth.uid())
  RETURNING id INTO v_lock_id;

  UPDATE public.tax_filing_periods SET status = 'locked', updated_at = now() WHERE id = p_filing_period_id;
  RETURN v_lock_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unlock_tax_filing_period(p_filing_period_id uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_period public.tax_filing_periods%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Unlock reason required (min 5 chars)';
  END IF;
  SELECT * INTO v_period FROM public.tax_filing_periods WHERE id = p_filing_period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Filing period not found'; END IF;
  IF NOT public.is_org_member(auth.uid(), v_period.organization_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.tax_period_locks
    SET is_active = false, override_reason = p_reason
    WHERE filing_period_id = p_filing_period_id AND is_active = true;

  UPDATE public.tax_filing_periods SET status = 'open', updated_at = now() WHERE id = p_filing_period_id;
  RETURN true;
END;
$function$;