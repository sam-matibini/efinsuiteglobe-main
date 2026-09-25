CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: account_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_type AS ENUM (
    'asset',
    'liability',
    'equity',
    'income',
    'expense'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'subscriber',
    'user'
);


--
-- Name: employee_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employee_status AS ENUM (
    'active',
    'on_leave',
    'terminated',
    'onboarding'
);


--
-- Name: employment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employment_type AS ENUM (
    'full_time',
    'part_time',
    'contract',
    'temporary'
);


--
-- Name: journal_entry_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.journal_entry_status AS ENUM (
    'draft',
    'posted',
    'reversed'
);


--
-- Name: journal_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.journal_type AS ENUM (
    'manual',
    'sales',
    'purchase',
    'payroll',
    'bank',
    'adjustment',
    'depreciation'
);


--
-- Name: onboarding_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.onboarding_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'skipped'
);


--
-- Name: pay_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pay_frequency AS ENUM (
    'weekly',
    'bi_weekly',
    'semi_monthly',
    'monthly'
);


--
-- Name: pay_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pay_run_status AS ENUM (
    'draft',
    'processing',
    'approved',
    'paid',
    'cancelled'
);


--
-- Name: province_code; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.province_code AS ENUM (
    'AB',
    'BC',
    'MB',
    'NB',
    'NL',
    'NS',
    'NT',
    'NU',
    'ON',
    'PE',
    'QC',
    'SK',
    'YT'
);


--
-- Name: roe_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.roe_reason AS ENUM (
    'A',
    'B',
    'D',
    'E',
    'F',
    'G',
    'H',
    'J',
    'K',
    'M',
    'N',
    'P',
    'Z'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'canceled',
    'past_due',
    'trialing',
    'incomplete'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: is_org_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;


--
-- Name: prevent_posted_entry_modification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_posted_entry_modification() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  entry_status TEXT;
BEGIN
  -- Get the status of the parent journal entry
  SELECT status INTO entry_status
  FROM public.journal_entries
  WHERE id = COALESCE(OLD.journal_entry_id, NEW.journal_entry_id);
  
  -- Prevent modifications to posted entries (except reversals which create new entries)
  IF entry_status = 'posted' THEN
    IF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'Cannot modify lines of a posted journal entry. Create a reversing entry instead.';
    ELSIF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete lines from a posted journal entry. Create a reversing entry instead.';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_reconciled_bank_transaction_modification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_reconciled_bank_transaction_modification() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if the transaction is cleared (reconciled)
  IF OLD.is_cleared = TRUE THEN
    -- Allow only clearing/unclearing during active reconciliation
    -- But prevent all other modifications
    IF TG_OP = 'UPDATE' THEN
      -- Allow toggling is_cleared and cleared_at during reconciliation
      IF (NEW.is_cleared IS DISTINCT FROM OLD.is_cleared) OR 
         (NEW.cleared_at IS DISTINCT FROM OLD.cleared_at) THEN
        -- This is allowed - toggling cleared status during reconciliation
        RETURN NEW;
      END IF;
      
      -- Prevent modification of other fields on reconciled transactions
      RAISE EXCEPTION 'Cannot modify a reconciled bank transaction. Unreconcile the transaction first or create an adjusting entry.';
    ELSIF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete a reconciled bank transaction. Create a reversing entry instead.';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_reconciled_cc_transaction_modification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_reconciled_cc_transaction_modification() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if the transaction is cleared (reconciled)
  IF OLD.is_cleared = TRUE THEN
    -- Allow only clearing/unclearing during active reconciliation
    -- But prevent all other modifications
    IF TG_OP = 'UPDATE' THEN
      -- Allow toggling is_cleared and cleared_at during reconciliation
      IF (NEW.is_cleared IS DISTINCT FROM OLD.is_cleared) OR 
         (NEW.cleared_at IS DISTINCT FROM OLD.cleared_at) THEN
        -- This is allowed - toggling cleared status during reconciliation
        RETURN NEW;
      END IF;
      
      -- Prevent modification of other fields on reconciled transactions
      RAISE EXCEPTION 'Cannot modify a reconciled credit card transaction. Unreconcile the transaction first or create an adjusting entry.';
    ELSIF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete a reconciled credit card transaction. Create a reversing entry instead.';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: protect_account_balance_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_account_balance_integrity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Allow updates that don't change current_balance
  IF OLD.current_balance = NEW.current_balance THEN
    RETURN NEW;
  END IF;
  
  -- Allow system-level updates (from triggers/functions) by checking if we're in a transaction
  -- that originated from journal entry operations
  IF current_setting('app.allow_balance_update', true) = 'true' THEN
    RETURN NEW;
  END IF;
  
  -- For now, allow balance updates but log a warning
  -- In production, you might want to raise an exception instead
  RETURN NEW;
END;
$$;


--
-- Name: update_inventory_average_cost(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_inventory_average_cost() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.transaction_type IN ('purchase', 'receive') THEN
    UPDATE public.inventory_items
    SET 
      average_cost = (
        SELECT CASE 
          WHEN SUM(quantity_remaining) > 0 
          THEN SUM(quantity_remaining * unit_cost) / SUM(quantity_remaining)
          ELSE COALESCE(cost_price, 0)
        END
        FROM public.inventory_lots
        WHERE item_id = NEW.item_id AND quantity_remaining > 0
      ),
      last_purchase_price = NEW.unit_cost,
      last_purchase_date = NEW.transaction_date::DATE
    WHERE id = NEW.item_id;
  ELSIF NEW.transaction_type IN ('sale', 'invoice') THEN
    UPDATE public.inventory_items
    SET 
      last_sale_price = NEW.unit_cost,
      last_sale_date = NEW.transaction_date::DATE
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: validate_journal_entry_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_journal_entry_balance() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  total_debits NUMERIC;
  total_credits NUMERIC;
BEGIN
  -- Calculate sum of debits and credits for this journal entry
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debits, total_credits
  FROM public.journal_entry_lines
  WHERE journal_entry_id = NEW.journal_entry_id;

  -- Check if debits equal credits (allowing for small floating point differences)
  IF ABS(total_debits - total_credits) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Total debits (%) must equal total credits (%)',
      total_debits, total_credits;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: validate_journal_entry_completeness(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_journal_entry_completeness() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  line_count INTEGER;
  total_debits NUMERIC;
  total_credits NUMERIC;
BEGIN
  -- Only validate when status is being changed to 'posted'
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    -- Count lines for this journal entry
    SELECT COUNT(*), COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO line_count, total_debits, total_credits
    FROM public.journal_entry_lines
    WHERE journal_entry_id = NEW.id;

    -- Must have at least 2 lines for double-entry
    IF line_count < 2 THEN
      RAISE EXCEPTION 'Journal entry must have at least 2 lines for double-entry accounting';
    END IF;

    -- Debits must equal credits
    IF ABS(total_debits - total_credits) > 0.01 THEN
      RAISE EXCEPTION 'Cannot post unbalanced journal entry. Debits (%) must equal credits (%)',
        total_debits, total_credits;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: validate_journal_line_on_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_journal_line_on_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  total_debits NUMERIC;
  total_credits NUMERIC;
  entry_status TEXT;
BEGIN
  -- Get entry status
  SELECT status INTO entry_status
  FROM public.journal_entries
  WHERE id = NEW.journal_entry_id;
  
  -- Only validate for posted entries (drafts can be temporarily unbalanced)
  IF entry_status = 'posted' THEN
    SELECT 
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO total_debits, total_credits
    FROM public.journal_entry_lines
    WHERE journal_entry_id = NEW.journal_entry_id;
    
    -- Add the new line values
    total_debits := total_debits + COALESCE(NEW.debit, 0);
    total_credits := total_credits + COALESCE(NEW.credit, 0);
    
    IF ABS(total_debits - total_credits) > 0.01 THEN
      RAISE EXCEPTION 'Cannot insert line that would unbalance a posted journal entry. Debits (%) must equal credits (%)',
        total_debits, total_credits;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: validate_journal_line_organization(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_journal_line_organization() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  entry_org_id UUID;
  account_org_id UUID;
BEGIN
  -- Get the organization ID from the journal entry
  SELECT organization_id INTO entry_org_id
  FROM public.journal_entries
  WHERE id = NEW.journal_entry_id;
  
  -- Get the organization ID from the account
  SELECT organization_id INTO account_org_id
  FROM public.accounts
  WHERE id = NEW.account_id;
  
  -- Validate they match
  IF entry_org_id IS DISTINCT FROM account_org_id THEN
    RAISE EXCEPTION 'Account organization (%) does not match journal entry organization (%)',
      account_org_id, entry_org_id;
  END IF;
  
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    account_type public.account_type NOT NULL,
    parent_id uuid,
    description text,
    is_header boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    normal_balance character varying(10) DEFAULT 'debit'::character varying NOT NULL,
    opening_balance numeric(15,2) DEFAULT 0,
    current_balance numeric(15,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    account_class text,
    account_group text,
    account_sub_group text,
    is_current boolean DEFAULT true,
    posting_allowed boolean DEFAULT true,
    CONSTRAINT accounts_normal_balance_check CHECK (((normal_balance)::text = ANY ((ARRAY['debit'::character varying, 'credit'::character varying])::text[])))
);


--
-- Name: approval_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    approval_request_id uuid NOT NULL,
    step_order integer NOT NULL,
    action text NOT NULL,
    action_by uuid NOT NULL,
    action_at timestamp with time zone DEFAULT now() NOT NULL,
    comments text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_actions_action_check CHECK ((action = ANY (ARRAY['approved'::text, 'rejected'::text, 'returned'::text])))
);


--
-- Name: approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    workflow_id uuid,
    document_type text NOT NULL,
    document_id uuid NOT NULL,
    current_step integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_by uuid NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: approval_workflow_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_workflow_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    step_order integer NOT NULL,
    approver_type text NOT NULL,
    approver_id uuid,
    min_amount numeric(15,2),
    max_amount numeric(15,2),
    requires_all boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_workflow_steps_approver_type_check CHECK ((approver_type = ANY (ARRAY['user'::text, 'role'::text, 'manager'::text])))
);


--
-- Name: approval_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text NOT NULL,
    document_type text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_workflows_document_type_check CHECK ((document_type = ANY (ARRAY['invoice'::text, 'bill'::text, 'purchase_order'::text, 'expense_claim'::text, 'credit_note'::text, 'vendor_credit'::text])))
);


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    institution character varying(255) NOT NULL,
    account_number character varying(20),
    currency character varying(3) DEFAULT 'CAD'::character varying NOT NULL,
    opening_balance numeric DEFAULT 0 NOT NULL,
    current_balance numeric DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_reconciled_at timestamp with time zone,
    last_reconciled_balance numeric,
    gl_account_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    opening_date date DEFAULT CURRENT_DATE
);


--
-- Name: bank_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_reconciliations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_account_id uuid NOT NULL,
    statement_date date NOT NULL,
    statement_balance numeric NOT NULL,
    reconciled_balance numeric,
    difference numeric,
    status character varying(20) DEFAULT 'in_progress'::character varying NOT NULL,
    completed_at timestamp with time zone,
    completed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bank_reconciliations_status_check CHECK (((status)::text = ANY ((ARRAY['in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: bank_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_account_id uuid NOT NULL,
    transaction_date date NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    transaction_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'unmatched'::character varying NOT NULL,
    category character varying(255),
    matched_invoice_id uuid,
    matched_bill_id uuid,
    gl_account_id uuid,
    journal_entry_id uuid,
    memo text,
    reference character varying(100),
    is_cleared boolean DEFAULT false NOT NULL,
    cleared_at timestamp with time zone,
    imported_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payee_payor text,
    CONSTRAINT bank_transactions_status_check CHECK (((status)::text = ANY ((ARRAY['unmatched'::character varying, 'matched'::character varying, 'reconciled'::character varying])::text[]))),
    CONSTRAINT bank_transactions_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['deposit'::character varying, 'withdrawal'::character varying])::text[])))
);


--
-- Name: bill_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bill_id uuid NOT NULL,
    description text NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    tax_rate numeric DEFAULT 0,
    tax_amount numeric DEFAULT 0,
    expense_account_id uuid,
    line_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0
);


--
-- Name: bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    vendor_id uuid NOT NULL,
    bill_number character varying NOT NULL,
    bill_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date NOT NULL,
    subtotal numeric DEFAULT 0 NOT NULL,
    tax_amount numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    amount_paid numeric DEFAULT 0 NOT NULL,
    balance_due numeric DEFAULT 0 NOT NULL,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    currency character varying DEFAULT 'CAD'::character varying NOT NULL,
    notes text,
    terms text,
    ap_account_id uuid,
    journal_entry_id uuid,
    received_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    purchase_order_id uuid,
    exchange_rate numeric(18,8) DEFAULT 1,
    base_currency_total numeric(15,2),
    discount_type text,
    discount_value numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    payment_terms_id uuid,
    CONSTRAINT bills_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text])))
);


--
-- Name: compilation_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compilation_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    fiscal_year character varying(4) NOT NULL,
    fiscal_year_end date NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    report_date date DEFAULT CURRENT_DATE NOT NULL,
    prepared_by text,
    issued_at timestamp with time zone,
    notes jsonb DEFAULT '[]'::jsonb,
    selected_note_templates jsonb DEFAULT '[]'::jsonb,
    custom_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT compilation_reports_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'issued'::character varying])::text[])))
);


--
-- Name: cost_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    product_service_id uuid,
    cost_type text NOT NULL,
    description text,
    amount numeric(15,4) DEFAULT 0 NOT NULL,
    allocation_method text DEFAULT 'percentage'::text,
    allocation_rate numeric(10,4),
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cost_allocations_allocation_method_check CHECK ((allocation_method = ANY (ARRAY['percentage'::text, 'fixed'::text, 'per_unit'::text, 'hourly'::text]))),
    CONSTRAINT cost_allocations_cost_type_check CHECK ((cost_type = ANY (ARRAY['direct_labor'::text, 'direct_material'::text, 'overhead'::text, 'fixed'::text, 'variable'::text])))
);


--
-- Name: credit_card_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_card_reconciliations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    credit_card_id uuid NOT NULL,
    statement_date date NOT NULL,
    statement_balance numeric NOT NULL,
    reconciled_balance numeric,
    difference numeric,
    status text DEFAULT 'in_progress'::text NOT NULL,
    notes text,
    completed_at timestamp with time zone,
    completed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: credit_card_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_card_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    credit_card_id uuid NOT NULL,
    transaction_date date NOT NULL,
    posted_date date,
    description text NOT NULL,
    amount numeric NOT NULL,
    transaction_type text DEFAULT 'charge'::text NOT NULL,
    category text,
    merchant_category_code text,
    payee_payor text,
    memo text,
    reference text,
    is_cleared boolean DEFAULT false,
    cleared_at timestamp with time zone,
    gl_account_id uuid,
    journal_entry_id uuid,
    status text DEFAULT 'pending'::text,
    imported_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: credit_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text NOT NULL,
    issuer text NOT NULL,
    card_number text,
    credit_limit numeric DEFAULT 0,
    currency text DEFAULT 'CAD'::text,
    opening_balance numeric DEFAULT 0,
    current_balance numeric DEFAULT 0,
    statement_closing_day integer DEFAULT 25,
    payment_due_day integer DEFAULT 21,
    is_active boolean DEFAULT true,
    last_reconciled_at timestamp with time zone,
    last_reconciled_balance numeric,
    gl_account_id uuid,
    opening_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: credit_note_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_note_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    credit_note_id uuid NOT NULL,
    description text NOT NULL,
    quantity numeric(15,4) DEFAULT 1 NOT NULL,
    unit_price numeric(15,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    line_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: credit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    customer_id uuid NOT NULL,
    invoice_id uuid,
    credit_note_number text NOT NULL,
    credit_note_date date DEFAULT CURRENT_DATE NOT NULL,
    reason text,
    status text DEFAULT 'draft'::text NOT NULL,
    subtotal numeric(15,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
    total numeric(15,2) DEFAULT 0 NOT NULL,
    amount_applied numeric(15,2) DEFAULT 0 NOT NULL,
    balance_remaining numeric(15,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'CAD'::text NOT NULL,
    notes text,
    journal_entry_id uuid,
    issued_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT credit_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'applied'::text, 'voided'::text])))
);


--
-- Name: currencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.currencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    symbol text NOT NULL,
    decimal_places integer DEFAULT 2 NOT NULL,
    is_base boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    customer_id uuid NOT NULL,
    invoice_id uuid,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric NOT NULL,
    payment_method character varying(50),
    reference character varying(100),
    notes text,
    bank_account_id uuid,
    bank_transaction_id uuid,
    journal_entry_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_statements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    customer_id uuid NOT NULL,
    statement_date date DEFAULT CURRENT_DATE NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    opening_balance numeric(15,2) DEFAULT 0 NOT NULL,
    total_invoiced numeric(15,2) DEFAULT 0 NOT NULL,
    total_payments numeric(15,2) DEFAULT 0 NOT NULL,
    total_credits numeric(15,2) DEFAULT 0 NOT NULL,
    closing_balance numeric(15,2) DEFAULT 0 NOT NULL,
    sent_at timestamp with time zone,
    sent_via text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    address_line1 text,
    address_line2 text,
    city character varying(100),
    province character varying(50),
    postal_code character varying(20),
    country character varying(50) DEFAULT 'CA'::character varying,
    tax_number character varying(50),
    payment_terms integer DEFAULT 30,
    credit_limit numeric DEFAULT 0,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: depreciation_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.depreciation_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    depreciation_amount numeric(15,2) NOT NULL,
    accumulated_depreciation numeric(15,2) NOT NULL,
    book_value numeric(15,2) NOT NULL,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    journal_entry_id uuid,
    posted_at timestamp with time zone,
    posted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_td1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_td1 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    tax_year integer DEFAULT EXTRACT(year FROM CURRENT_DATE) NOT NULL,
    form_type text DEFAULT 'federal'::text NOT NULL,
    basic_personal_amount numeric(10,2) DEFAULT 0 NOT NULL,
    age_amount numeric(10,2) DEFAULT 0,
    pension_income_amount numeric(10,2) DEFAULT 0,
    tuition_amount numeric(10,2) DEFAULT 0,
    disability_amount numeric(10,2) DEFAULT 0,
    spouse_amount numeric(10,2) DEFAULT 0,
    caregiver_amount numeric(10,2) DEFAULT 0,
    dependant_amount numeric(10,2) DEFAULT 0,
    canada_employment_amount numeric(10,2) DEFAULT 0,
    other_credits numeric(10,2) DEFAULT 0,
    total_claim_amount numeric(10,2) DEFAULT 0 NOT NULL,
    additional_tax_deduction numeric(10,2) DEFAULT 0,
    reduce_tax_deduction boolean DEFAULT false,
    non_resident boolean DEFAULT false,
    ai_suggested boolean DEFAULT false,
    ai_confidence numeric(3,2),
    signed_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    employee_number text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    date_of_birth date,
    sin_encrypted text,
    address_line1 text,
    address_line2 text,
    city text,
    province public.province_code DEFAULT 'ON'::public.province_code NOT NULL,
    postal_code text,
    country text DEFAULT 'CA'::text,
    hire_date date NOT NULL,
    termination_date date,
    employment_type public.employment_type DEFAULT 'full_time'::public.employment_type NOT NULL,
    status public.employee_status DEFAULT 'onboarding'::public.employee_status NOT NULL,
    department text,
    job_title text,
    manager_id uuid,
    pay_frequency public.pay_frequency DEFAULT 'bi_weekly'::public.pay_frequency NOT NULL,
    annual_salary numeric(12,2),
    hourly_rate numeric(8,2),
    bank_institution text,
    bank_transit text,
    bank_account text,
    emergency_contact_name text,
    emergency_contact_phone text,
    emergency_contact_relationship text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    from_currency text NOT NULL,
    to_currency text NOT NULL,
    rate numeric(18,8) NOT NULL,
    effective_date date NOT NULL,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expense_claim_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_claim_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_claim_id uuid NOT NULL,
    expense_account_id uuid,
    expense_date date NOT NULL,
    description text NOT NULL,
    category text,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0,
    receipt_url text,
    is_billable boolean DEFAULT false,
    customer_id uuid,
    line_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expense_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    employee_id uuid NOT NULL,
    claim_number text NOT NULL,
    claim_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    total_amount numeric(15,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'CAD'::text NOT NULL,
    description text,
    notes text,
    submitted_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    approved_by uuid,
    approved_at timestamp with time zone,
    paid_at timestamp with time zone,
    payment_method text,
    payment_reference text,
    journal_entry_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expense_claims_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'paid'::text, 'voided'::text])))
);


--
-- Name: fiscal_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    closed_by uuid,
    closed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fiscal_periods_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying, 'locked'::character varying])::text[])))
);


--
-- Name: fixed_asset_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixed_asset_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    default_useful_life_months integer DEFAULT 60 NOT NULL,
    default_depreciation_method character varying(50) DEFAULT 'straight_line'::character varying NOT NULL,
    default_declining_rate numeric(5,2) DEFAULT 20,
    asset_account_id uuid,
    depreciation_account_id uuid,
    accumulated_depreciation_account_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fixed_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixed_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    category_id uuid,
    asset_number character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    serial_number character varying(100),
    location character varying(255),
    acquisition_date date NOT NULL,
    acquisition_cost numeric(15,2) NOT NULL,
    acquisition_method character varying(50) DEFAULT 'purchase'::character varying NOT NULL,
    vendor_id uuid,
    bill_id uuid,
    useful_life_months integer NOT NULL,
    salvage_value numeric(15,2) DEFAULT 0 NOT NULL,
    depreciation_method character varying(50) DEFAULT 'straight_line'::character varying NOT NULL,
    declining_rate numeric(5,2) DEFAULT 20,
    depreciation_start_date date NOT NULL,
    accumulated_depreciation numeric(15,2) DEFAULT 0 NOT NULL,
    book_value numeric(15,2) NOT NULL,
    asset_account_id uuid,
    depreciation_account_id uuid,
    accumulated_depreciation_account_id uuid,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    disposal_date date,
    disposal_amount numeric(15,2),
    disposal_method character varying(50),
    disposal_journal_entry_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_adjustment_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_adjustment_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    adjustment_id uuid NOT NULL,
    item_id uuid NOT NULL,
    quantity_counted numeric(15,4) NOT NULL,
    quantity_on_hand numeric(15,4) NOT NULL,
    quantity_difference numeric(15,4) NOT NULL,
    unit_cost numeric(15,4) NOT NULL,
    total_adjustment numeric(15,2) NOT NULL,
    line_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    adjustment_number character varying(50) NOT NULL,
    adjustment_date date DEFAULT CURRENT_DATE NOT NULL,
    reason character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    journal_entry_id uuid,
    notes text,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    parent_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    category_id uuid,
    sku character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    unit_of_measure character varying(50) DEFAULT 'each'::character varying NOT NULL,
    cost_price numeric(15,2) DEFAULT 0 NOT NULL,
    selling_price numeric(15,2) DEFAULT 0 NOT NULL,
    quantity_on_hand numeric(15,4) DEFAULT 0 NOT NULL,
    reorder_point numeric(15,4) DEFAULT 0,
    reorder_quantity numeric(15,4) DEFAULT 0,
    inventory_account_id uuid,
    cogs_account_id uuid,
    income_account_id uuid,
    is_taxable boolean DEFAULT true NOT NULL,
    tax_rate numeric(5,2) DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    valuation_method text DEFAULT 'fifo'::text,
    min_order_quantity integer DEFAULT 1,
    max_stock_level integer,
    lead_time_days integer DEFAULT 0,
    safety_stock integer DEFAULT 0,
    last_purchase_price numeric(15,4),
    last_purchase_date date,
    average_cost numeric(15,4) DEFAULT 0,
    last_sale_price numeric(15,4),
    last_sale_date date,
    weight numeric(10,4),
    weight_unit text DEFAULT 'kg'::text,
    dimensions_length numeric(10,2),
    dimensions_width numeric(10,2),
    dimensions_height numeric(10,2),
    dimensions_unit text DEFAULT 'cm'::text,
    bin_location text,
    manufacturer text,
    manufacturer_part_number text,
    warranty_months integer,
    CONSTRAINT inventory_items_dimensions_unit_check CHECK ((dimensions_unit = ANY (ARRAY['cm'::text, 'in'::text, 'm'::text, 'ft'::text]))),
    CONSTRAINT inventory_items_valuation_method_check CHECK ((valuation_method = ANY (ARRAY['fifo'::text, 'lifo'::text, 'weighted_average'::text, 'specific_identification'::text]))),
    CONSTRAINT inventory_items_weight_unit_check CHECK ((weight_unit = ANY (ARRAY['kg'::text, 'lb'::text, 'oz'::text, 'g'::text])))
);


--
-- Name: inventory_lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_lots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    lot_number character varying(100),
    quantity_received numeric(15,4) NOT NULL,
    quantity_remaining numeric(15,4) NOT NULL,
    unit_cost numeric(15,4) NOT NULL,
    received_date date DEFAULT CURRENT_DATE NOT NULL,
    expiry_date date,
    reference character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    item_id uuid NOT NULL,
    lot_id uuid,
    transaction_type character varying(50) NOT NULL,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    reference character varying(255),
    quantity numeric(15,4) NOT NULL,
    unit_cost numeric(15,4) NOT NULL,
    total_cost numeric(15,2) NOT NULL,
    bill_id uuid,
    invoice_id uuid,
    journal_entry_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_valuations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_valuations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    valuation_date date NOT NULL,
    total_items integer DEFAULT 0 NOT NULL,
    total_quantity numeric(15,4) DEFAULT 0 NOT NULL,
    total_value numeric(15,4) DEFAULT 0 NOT NULL,
    valuation_method text DEFAULT 'fifo'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    description text NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    tax_rate numeric DEFAULT 0,
    tax_amount numeric DEFAULT 0,
    income_account_id uuid,
    line_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    customer_id uuid NOT NULL,
    invoice_number character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date NOT NULL,
    subtotal numeric DEFAULT 0 NOT NULL,
    tax_amount numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    amount_paid numeric DEFAULT 0 NOT NULL,
    balance_due numeric DEFAULT 0 NOT NULL,
    currency character varying(3) DEFAULT 'CAD'::character varying NOT NULL,
    notes text,
    terms text,
    ar_account_id uuid,
    journal_entry_id uuid,
    sent_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exchange_rate numeric(18,8) DEFAULT 1,
    base_currency_total numeric(15,2),
    discount_type text,
    discount_value numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    payment_terms_id uuid,
    CONSTRAINT invoices_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text]))),
    CONSTRAINT invoices_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'paid'::character varying, 'overdue'::character varying, 'void'::character varying, 'partial'::character varying])::text[])))
);


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    reference character varying(50) NOT NULL,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    description text,
    status public.journal_entry_status DEFAULT 'draft'::public.journal_entry_status NOT NULL,
    created_by uuid,
    posted_by uuid,
    posted_at timestamp with time zone,
    reversed_by uuid,
    reversed_at timestamp with time zone,
    reversal_of uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    journal_type public.journal_type DEFAULT 'manual'::public.journal_type NOT NULL
);


--
-- Name: journal_entry_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entry_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_entry_id uuid NOT NULL,
    account_id uuid NOT NULL,
    description text,
    debit numeric(15,2) DEFAULT 0 NOT NULL,
    credit numeric(15,2) DEFAULT 0 NOT NULL,
    line_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT positive_amounts CHECK (((debit >= (0)::numeric) AND (credit >= (0)::numeric))),
    CONSTRAINT single_side CHECK ((NOT ((debit > (0)::numeric) AND (credit > (0)::numeric))))
);


--
-- Name: lease_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lease_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text NOT NULL,
    description text,
    rou_asset_account_id uuid,
    lease_liability_account_id uuid,
    interest_expense_account_id uuid,
    depreciation_expense_account_id uuid,
    accumulated_depreciation_account_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lease_modifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lease_modifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lease_id uuid NOT NULL,
    modification_date date NOT NULL,
    modification_type text NOT NULL,
    description text,
    previous_end_date date,
    previous_payment_amount numeric(15,2),
    previous_term_months integer,
    new_end_date date,
    new_payment_amount numeric(15,2),
    new_term_months integer,
    remeasurement_amount numeric(15,2),
    discount_rate_used numeric(8,4),
    journal_entry_id uuid,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lease_modifications_modification_type_check CHECK ((modification_type = ANY (ARRAY['extension'::text, 'termination'::text, 'payment_change'::text, 'scope_change'::text])))
);


--
-- Name: lease_payment_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lease_payment_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lease_id uuid NOT NULL,
    payment_number integer NOT NULL,
    payment_date date NOT NULL,
    payment_amount numeric(15,2) NOT NULL,
    principal_amount numeric(15,2) NOT NULL,
    interest_amount numeric(15,2) NOT NULL,
    opening_liability numeric(15,2) NOT NULL,
    closing_liability numeric(15,2) NOT NULL,
    depreciation_amount numeric(15,2) NOT NULL,
    rou_asset_opening numeric(15,2) NOT NULL,
    rou_asset_closing numeric(15,2) NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    actual_payment_date date,
    actual_payment_amount numeric(15,2),
    journal_entry_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lease_payment_schedule_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text])))
);


--
-- Name: leases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    lease_number text NOT NULL,
    name text NOT NULL,
    description text,
    category_id uuid,
    lessor_name text NOT NULL,
    lessor_contact text,
    lease_type text DEFAULT 'finance'::text NOT NULL,
    asset_type text DEFAULT 'equipment'::text NOT NULL,
    commencement_date date NOT NULL,
    end_date date NOT NULL,
    term_months integer NOT NULL,
    payment_amount numeric(15,2) NOT NULL,
    payment_frequency text DEFAULT 'monthly'::text NOT NULL,
    payment_timing text DEFAULT 'end'::text NOT NULL,
    first_payment_date date NOT NULL,
    discount_rate numeric(8,4) NOT NULL,
    initial_direct_costs numeric(15,2) DEFAULT 0,
    lease_incentives_received numeric(15,2) DEFAULT 0,
    residual_value_guarantee numeric(15,2) DEFAULT 0,
    purchase_option_price numeric(15,2),
    purchase_option_reasonably_certain boolean DEFAULT false,
    present_value_payments numeric(15,2) NOT NULL,
    rou_asset_initial numeric(15,2) NOT NULL,
    lease_liability_initial numeric(15,2) NOT NULL,
    rou_asset_current numeric(15,2) NOT NULL,
    lease_liability_current numeric(15,2) NOT NULL,
    accumulated_depreciation numeric(15,2) DEFAULT 0,
    accumulated_interest numeric(15,2) DEFAULT 0,
    rou_asset_account_id uuid,
    lease_liability_account_id uuid,
    interest_expense_account_id uuid,
    depreciation_expense_account_id uuid,
    accumulated_depreciation_account_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    commencement_journal_id uuid,
    currency text DEFAULT 'CAD'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leases_asset_type_check CHECK ((asset_type = ANY (ARRAY['real_estate'::text, 'equipment'::text, 'vehicle'::text, 'other'::text]))),
    CONSTRAINT leases_lease_type_check CHECK ((lease_type = ANY (ARRAY['finance'::text, 'operating'::text, 'short_term'::text, 'low_value'::text]))),
    CONSTRAINT leases_payment_frequency_check CHECK ((payment_frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'annually'::text]))),
    CONSTRAINT leases_payment_timing_check CHECK ((payment_timing = ANY (ARRAY['beginning'::text, 'end'::text]))),
    CONSTRAINT leases_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'modified'::text, 'terminated'::text, 'expired'::text])))
);


--
-- Name: onboarding_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    task_name text NOT NULL,
    task_category text NOT NULL,
    description text,
    status public.onboarding_status DEFAULT 'pending'::public.onboarding_status NOT NULL,
    due_date date,
    completed_date date,
    assigned_to uuid,
    notes text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text,
    logo_url text,
    owner_id uuid,
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    address_line1 text,
    address_line2 text,
    city text,
    province text,
    postal_code text,
    country text DEFAULT 'CA'::text,
    phone text,
    email text,
    website text,
    legal_name text,
    business_number text,
    industry text,
    fiscal_year_end_month integer DEFAULT 12,
    currency text DEFAULT 'CAD'::text,
    accounting_method text DEFAULT 'accrual'::text,
    invoice_prefix text DEFAULT 'INV-'::text,
    invoice_next_number integer DEFAULT 1001,
    invoice_default_terms integer DEFAULT 30,
    invoice_default_notes text,
    invoice_footer text,
    invoice_show_logo boolean DEFAULT true,
    invoice_show_payment_instructions boolean DEFAULT true,
    invoice_payment_instructions text,
    invoice_template_type text DEFAULT 'invoice'::text,
    invoice_template_style text DEFAULT 'modern'::text,
    invoice_primary_color text DEFAULT '#1e40af'::text,
    invoice_secondary_color text DEFAULT '#64748b'::text,
    invoice_font_family text DEFAULT 'Inter'::text,
    invoice_date_format text DEFAULT 'mdy'::text,
    invoice_show_line_numbers boolean DEFAULT true,
    invoice_show_tax_column boolean DEFAULT true,
    invoice_show_quantity_column boolean DEFAULT true,
    invoice_show_rate_column boolean DEFAULT true,
    invoice_header_alignment text DEFAULT 'left'::text,
    invoice_accent_style text DEFAULT 'line'::text,
    invoice_enable_online_payments boolean DEFAULT false,
    invoice_payment_methods jsonb DEFAULT '[]'::jsonb,
    invoice_ach_enabled boolean DEFAULT false,
    invoice_credit_card_enabled boolean DEFAULT false,
    invoice_stripe_account_id text,
    invoice_custom_title text DEFAULT 'INVOICE'::text
);


--
-- Name: pay_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pay_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    pay_period_start date NOT NULL,
    pay_period_end date NOT NULL,
    pay_date date NOT NULL,
    status public.pay_run_status DEFAULT 'draft'::public.pay_run_status NOT NULL,
    total_gross numeric(14,2) DEFAULT 0,
    total_deductions numeric(14,2) DEFAULT 0,
    total_net numeric(14,2) DEFAULT 0,
    total_employer_contributions numeric(14,2) DEFAULT 0,
    employee_count integer DEFAULT 0,
    notes text,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pay_stubs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pay_stubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pay_run_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    regular_hours numeric(6,2) DEFAULT 0,
    overtime_hours numeric(6,2) DEFAULT 0,
    vacation_hours numeric(6,2) DEFAULT 0,
    sick_hours numeric(6,2) DEFAULT 0,
    regular_earnings numeric(12,2) DEFAULT 0,
    overtime_earnings numeric(12,2) DEFAULT 0,
    vacation_pay numeric(12,2) DEFAULT 0,
    bonus numeric(12,2) DEFAULT 0,
    commission numeric(12,2) DEFAULT 0,
    other_earnings numeric(12,2) DEFAULT 0,
    gross_pay numeric(12,2) DEFAULT 0 NOT NULL,
    federal_tax numeric(10,2) DEFAULT 0,
    provincial_tax numeric(10,2) DEFAULT 0,
    cpp_contribution numeric(10,2) DEFAULT 0,
    ei_premium numeric(10,2) DEFAULT 0,
    other_deductions numeric(10,2) DEFAULT 0,
    total_deductions numeric(12,2) DEFAULT 0 NOT NULL,
    net_pay numeric(12,2) DEFAULT 0 NOT NULL,
    cpp_employer numeric(10,2) DEFAULT 0,
    ei_employer numeric(10,2) DEFAULT 0,
    ytd_gross numeric(14,2) DEFAULT 0,
    ytd_cpp numeric(12,2) DEFAULT 0,
    ytd_ei numeric(12,2) DEFAULT 0,
    ytd_federal_tax numeric(12,2) DEFAULT 0,
    ytd_provincial_tax numeric(12,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text NOT NULL,
    days_until_due integer NOT NULL,
    early_payment_discount_percent numeric(5,2) DEFAULT 0,
    early_payment_days integer,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pricing_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    price_monthly numeric DEFAULT 0 NOT NULL,
    price_yearly numeric DEFAULT 0 NOT NULL,
    stripe_price_id_monthly text,
    stripe_price_id_yearly text,
    features jsonb DEFAULT '[]'::jsonb,
    max_employees integer,
    max_users integer,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_service_id uuid,
    price_type text NOT NULL,
    old_price numeric(15,4),
    new_price numeric(15,4) NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid,
    reason text,
    CONSTRAINT product_price_history_price_type_check CHECK ((price_type = ANY (ARRAY['selling'::text, 'cost'::text, 'labor'::text, 'material'::text, 'overhead'::text])))
);


--
-- Name: products_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    type text NOT NULL,
    name text NOT NULL,
    sku text,
    description text,
    selling_price numeric(15,2) DEFAULT 0 NOT NULL,
    cost_price numeric(15,2) DEFAULT 0,
    unit_of_measure text DEFAULT 'each'::text,
    is_taxable boolean DEFAULT true,
    tax_rate numeric(5,2),
    income_account_id uuid,
    expense_account_id uuid,
    inventory_item_id uuid,
    is_active boolean DEFAULT true,
    category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cost_method text DEFAULT 'standard'::text,
    standard_cost numeric(15,4),
    last_cost numeric(15,4),
    average_cost numeric(15,4),
    margin_percent numeric(5,2),
    markup_percent numeric(5,2),
    min_selling_price numeric(15,4),
    max_discount_percent numeric(5,2) DEFAULT 100,
    commission_percent numeric(5,2),
    labor_cost numeric(15,4),
    material_cost numeric(15,4),
    overhead_cost numeric(15,4),
    billable_rate numeric(15,4),
    internal_rate numeric(15,4),
    currency text DEFAULT 'CAD'::text,
    pricing_tier text DEFAULT 'standard'::text,
    CONSTRAINT products_services_cost_method_check CHECK ((cost_method = ANY (ARRAY['standard'::text, 'actual'::text, 'average'::text, 'fifo'::text]))),
    CONSTRAINT products_services_pricing_tier_check CHECK ((pricing_tier = ANY (ARRAY['standard'::text, 'premium'::text, 'economy'::text, 'wholesale'::text, 'custom'::text]))),
    CONSTRAINT products_services_type_check CHECK ((type = ANY (ARRAY['product'::text, 'service'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    product_service_id uuid,
    inventory_item_id uuid,
    description text NOT NULL,
    quantity_ordered numeric(15,4) DEFAULT 1 NOT NULL,
    quantity_received numeric(15,4) DEFAULT 0 NOT NULL,
    unit_price numeric(15,2) DEFAULT 0 NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    tax_rate numeric(5,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    line_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    vendor_id uuid NOT NULL,
    po_number text NOT NULL,
    po_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_date date,
    status text DEFAULT 'draft'::text NOT NULL,
    subtotal numeric(15,2) DEFAULT 0 NOT NULL,
    discount_type text,
    discount_value numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
    total numeric(15,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'CAD'::text NOT NULL,
    shipping_address text,
    terms text,
    notes text,
    internal_notes text,
    sent_at timestamp with time zone,
    acknowledged_at timestamp with time zone,
    received_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_orders_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text]))),
    CONSTRAINT purchase_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'acknowledged'::text, 'partial'::text, 'received'::text, 'cancelled'::text, 'closed'::text])))
);


--
-- Name: quote_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    product_service_id uuid,
    description text NOT NULL,
    quantity numeric(15,4) DEFAULT 1 NOT NULL,
    unit_price numeric(15,2) DEFAULT 0 NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    tax_rate numeric(5,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    line_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    customer_id uuid NOT NULL,
    quote_number text NOT NULL,
    quote_date date DEFAULT CURRENT_DATE NOT NULL,
    expiry_date date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    subtotal numeric(15,2) DEFAULT 0 NOT NULL,
    discount_type text,
    discount_value numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
    total numeric(15,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'CAD'::text NOT NULL,
    terms text,
    notes text,
    internal_notes text,
    converted_invoice_id uuid,
    converted_at timestamp with time zone,
    sent_at timestamp with time zone,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quotes_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text]))),
    CONSTRAINT quotes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'declined'::text, 'expired'::text, 'converted'::text])))
);


--
-- Name: recurring_bill_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_bill_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recurring_bill_id uuid NOT NULL,
    expense_account_id uuid,
    description text NOT NULL,
    quantity numeric(15,4) DEFAULT 1 NOT NULL,
    unit_price numeric(15,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    line_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recurring_bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    vendor_id uuid NOT NULL,
    template_name text NOT NULL,
    frequency text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    next_bill_date date NOT NULL,
    days_until_due integer DEFAULT 30 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    subtotal numeric(15,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
    total numeric(15,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'CAD'::text NOT NULL,
    terms text,
    notes text,
    bills_generated integer DEFAULT 0 NOT NULL,
    last_generated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recurring_bills_frequency_check CHECK ((frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'annually'::text]))),
    CONSTRAINT recurring_bills_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: recurring_invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_invoice_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recurring_invoice_id uuid NOT NULL,
    product_service_id uuid,
    description text NOT NULL,
    quantity numeric(15,4) DEFAULT 1 NOT NULL,
    unit_price numeric(15,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    line_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recurring_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    customer_id uuid NOT NULL,
    template_name text NOT NULL,
    frequency text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    next_invoice_date date NOT NULL,
    days_until_due integer DEFAULT 30 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    subtotal numeric(15,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
    total numeric(15,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'CAD'::text NOT NULL,
    terms text,
    notes text,
    auto_send boolean DEFAULT false NOT NULL,
    invoices_generated integer DEFAULT 0 NOT NULL,
    last_generated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recurring_invoices_frequency_check CHECK ((frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'annually'::text]))),
    CONSTRAINT recurring_invoices_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: remittances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.remittances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    remittance_period date NOT NULL,
    due_date date NOT NULL,
    total_cpp_employee numeric(12,2) DEFAULT 0,
    total_cpp_employer numeric(12,2) DEFAULT 0,
    total_ei_employee numeric(12,2) DEFAULT 0,
    total_ei_employer numeric(12,2) DEFAULT 0,
    total_federal_tax numeric(12,2) DEFAULT 0,
    total_provincial_tax numeric(12,2) DEFAULT 0,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text,
    paid_date date,
    confirmation_number text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roe_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roe_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    roe_serial text,
    reason_code public.roe_reason NOT NULL,
    first_day_worked date NOT NULL,
    last_day_paid date NOT NULL,
    final_pay_period_end date,
    total_insurable_hours numeric(8,2) NOT NULL,
    total_insurable_earnings numeric(12,2) NOT NULL,
    pay_period_type public.pay_frequency NOT NULL,
    insurable_earnings_by_period jsonb DEFAULT '[]'::jsonb,
    vacation_pay numeric(12,2) DEFAULT 0,
    statutory_holiday_pay numeric(12,2) DEFAULT 0,
    other_monies jsonb DEFAULT '{}'::jsonb,
    comments text,
    recall_date date,
    recall_code text,
    status text DEFAULT 'draft'::text,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_tax_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_tax_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    filing_frequency text DEFAULT 'quarterly'::text NOT NULL,
    gst_number text,
    pst_number text,
    qst_number text,
    hst_number text,
    default_tax_code text DEFAULT 'HST'::text,
    collect_gst boolean DEFAULT true,
    collect_pst boolean DEFAULT false,
    collect_hst boolean DEFAULT true,
    gst_rate numeric(5,2) DEFAULT 5.00,
    pst_rate numeric(5,2) DEFAULT 0.00,
    hst_rate numeric(5,2) DEFAULT 13.00,
    province text DEFAULT 'ON'::text,
    gst_collected_account_id uuid,
    gst_paid_account_id uuid,
    pst_collected_account_id uuid,
    pst_paid_account_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    plan_id uuid,
    stripe_subscription_id text,
    status public.subscription_status DEFAULT 'incomplete'::public.subscription_status NOT NULL,
    billing_cycle text DEFAULT 'monthly'::text,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tax_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    rate numeric(5,2) DEFAULT 0 NOT NULL,
    jurisdiction text,
    tax_type text DEFAULT 'sales'::text NOT NULL,
    is_recoverable boolean DEFAULT true,
    is_compound boolean DEFAULT false,
    is_active boolean DEFAULT true,
    gl_collected_account_id uuid,
    gl_paid_account_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tax_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    period_start date NOT NULL,
    period_end date NOT NULL,
    period_name text NOT NULL,
    due_date date NOT NULL,
    tax_collected numeric(12,2) DEFAULT 0,
    tax_paid numeric(12,2) DEFAULT 0,
    net_payable numeric(12,2) DEFAULT 0,
    adjustments numeric(12,2) DEFAULT 0,
    status text DEFAULT 'draft'::text NOT NULL,
    filed_at timestamp with time zone,
    filed_by uuid,
    paid_at timestamp with time zone,
    payment_reference text,
    notes text,
    journal_entry_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tax_slips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_slips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    tax_year integer NOT NULL,
    slip_type text DEFAULT 'T4'::text NOT NULL,
    employer_name text,
    employer_bn text,
    box_14_employment_income numeric(12,2) DEFAULT 0,
    box_16_cpp_contributions numeric(10,2) DEFAULT 0,
    box_17_cpp2_contributions numeric(10,2) DEFAULT 0,
    box_18_ei_premiums numeric(10,2) DEFAULT 0,
    box_20_rpp_contributions numeric(10,2) DEFAULT 0,
    box_22_income_tax_deducted numeric(12,2) DEFAULT 0,
    box_24_ei_insurable_earnings numeric(12,2) DEFAULT 0,
    box_26_cpp_pensionable_earnings numeric(12,2) DEFAULT 0,
    box_44_union_dues numeric(10,2) DEFAULT 0,
    box_46_charitable_donations numeric(10,2) DEFAULT 0,
    box_52_pension_adjustment numeric(10,2) DEFAULT 0,
    box_55_ppip_premiums numeric(10,2) DEFAULT 0,
    box_56_ppip_insurable_earnings numeric(12,2) DEFAULT 0,
    other_info jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'draft'::text,
    issued_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: transaction_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    logic_operator character varying(10) DEFAULT 'and'::character varying NOT NULL,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    matches_count integer DEFAULT 0 NOT NULL,
    last_matched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transaction_rules_logic_operator_check CHECK (((logic_operator)::text = ANY ((ARRAY['and'::character varying, 'or'::character varying])::text[])))
);


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid,
    date_format text DEFAULT 'mdy'::text NOT NULL,
    number_format text DEFAULT 'comma'::text NOT NULL,
    default_report_period text DEFAULT 'month'::text NOT NULL,
    email_notifications boolean DEFAULT true NOT NULL,
    due_date_reminders boolean DEFAULT true NOT NULL,
    reconciliation_alerts boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    negative_format text DEFAULT 'minus'::text NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendor_credit_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_credit_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_credit_id uuid NOT NULL,
    expense_account_id uuid,
    description text NOT NULL,
    quantity numeric(15,4) DEFAULT 1 NOT NULL,
    unit_price numeric(15,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    line_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendor_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_credits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    vendor_id uuid NOT NULL,
    bill_id uuid,
    credit_number text NOT NULL,
    credit_date date DEFAULT CURRENT_DATE NOT NULL,
    reason text,
    status text DEFAULT 'draft'::text NOT NULL,
    subtotal numeric(15,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
    total numeric(15,2) DEFAULT 0 NOT NULL,
    amount_applied numeric(15,2) DEFAULT 0 NOT NULL,
    balance_remaining numeric(15,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'CAD'::text NOT NULL,
    notes text,
    journal_entry_id uuid,
    issued_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vendor_credits_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'applied'::text, 'voided'::text])))
);


--
-- Name: vendor_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    vendor_id uuid NOT NULL,
    bill_id uuid,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric NOT NULL,
    payment_method character varying,
    reference character varying,
    notes text,
    bank_account_id uuid,
    bank_transaction_id uuid,
    journal_entry_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying NOT NULL,
    email character varying,
    phone character varying,
    address_line1 text,
    address_line2 text,
    city character varying,
    province character varying,
    postal_code character varying,
    country character varying DEFAULT 'CA'::character varying,
    tax_number character varying,
    payment_terms integer DEFAULT 30,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vendor_type character varying(20) DEFAULT 'organization'::character varying,
    first_name character varying(100),
    last_name character varying(100),
    is_contractor boolean DEFAULT false,
    t4a_required boolean DEFAULT false,
    sin_last_four character varying(4)
);


--
-- Name: accounts accounts_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_organization_id_code_key UNIQUE (organization_id, code);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: approval_actions approval_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_actions
    ADD CONSTRAINT approval_actions_pkey PRIMARY KEY (id);


--
-- Name: approval_requests approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (id);


--
-- Name: approval_workflow_steps approval_workflow_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflow_steps
    ADD CONSTRAINT approval_workflow_steps_pkey PRIMARY KEY (id);


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: bank_reconciliations bank_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_pkey PRIMARY KEY (id);


--
-- Name: bill_lines bill_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_lines
    ADD CONSTRAINT bill_lines_pkey PRIMARY KEY (id);


--
-- Name: bills bills_organization_id_bill_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_organization_id_bill_number_key UNIQUE (organization_id, bill_number);


--
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (id);


--
-- Name: compilation_reports compilation_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compilation_reports
    ADD CONSTRAINT compilation_reports_pkey PRIMARY KEY (id);


--
-- Name: cost_allocations cost_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_allocations
    ADD CONSTRAINT cost_allocations_pkey PRIMARY KEY (id);


--
-- Name: credit_card_reconciliations credit_card_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_card_reconciliations
    ADD CONSTRAINT credit_card_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: credit_card_transactions credit_card_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_pkey PRIMARY KEY (id);


--
-- Name: credit_cards credit_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_cards
    ADD CONSTRAINT credit_cards_pkey PRIMARY KEY (id);


--
-- Name: credit_note_lines credit_note_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_note_lines
    ADD CONSTRAINT credit_note_lines_pkey PRIMARY KEY (id);


--
-- Name: credit_notes credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_pkey PRIMARY KEY (id);


--
-- Name: currencies currencies_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_organization_id_code_key UNIQUE (organization_id, code);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (id);


--
-- Name: customer_payments customer_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_pkey PRIMARY KEY (id);


--
-- Name: customer_statements customer_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_statements
    ADD CONSTRAINT customer_statements_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: depreciation_entries depreciation_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_entries
    ADD CONSTRAINT depreciation_entries_pkey PRIMARY KEY (id);


--
-- Name: employee_td1 employee_td1_employee_id_tax_year_form_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_td1
    ADD CONSTRAINT employee_td1_employee_id_tax_year_form_type_key UNIQUE (employee_id, tax_year, form_type);


--
-- Name: employee_td1 employee_td1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_td1
    ADD CONSTRAINT employee_td1_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_organization_id_from_currency_to_currency_ef_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_organization_id_from_currency_to_currency_ef_key UNIQUE (organization_id, from_currency, to_currency, effective_date);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: expense_claim_lines expense_claim_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claim_lines
    ADD CONSTRAINT expense_claim_lines_pkey PRIMARY KEY (id);


--
-- Name: expense_claims expense_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_pkey PRIMARY KEY (id);


--
-- Name: fiscal_periods fiscal_periods_organization_id_start_date_end_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_organization_id_start_date_end_date_key UNIQUE (organization_id, start_date, end_date);


--
-- Name: fiscal_periods fiscal_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_pkey PRIMARY KEY (id);


--
-- Name: fixed_asset_categories fixed_asset_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_asset_categories
    ADD CONSTRAINT fixed_asset_categories_pkey PRIMARY KEY (id);


--
-- Name: fixed_assets fixed_assets_organization_id_asset_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_organization_id_asset_number_key UNIQUE (organization_id, asset_number);


--
-- Name: fixed_assets fixed_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_pkey PRIMARY KEY (id);


--
-- Name: inventory_adjustment_lines inventory_adjustment_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustment_lines
    ADD CONSTRAINT inventory_adjustment_lines_pkey PRIMARY KEY (id);


--
-- Name: inventory_adjustments inventory_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_organization_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_organization_id_sku_key UNIQUE (organization_id, sku);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_lots inventory_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lots
    ADD CONSTRAINT inventory_lots_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: inventory_valuations inventory_valuations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_valuations
    ADD CONSTRAINT inventory_valuations_pkey PRIMARY KEY (id);


--
-- Name: invoice_lines invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_organization_id_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_organization_id_reference_key UNIQUE (organization_id, reference);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_entry_lines journal_entry_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_pkey PRIMARY KEY (id);


--
-- Name: lease_categories lease_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_categories
    ADD CONSTRAINT lease_categories_pkey PRIMARY KEY (id);


--
-- Name: lease_modifications lease_modifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_modifications
    ADD CONSTRAINT lease_modifications_pkey PRIMARY KEY (id);


--
-- Name: lease_payment_schedule lease_payment_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_payment_schedule
    ADD CONSTRAINT lease_payment_schedule_pkey PRIMARY KEY (id);


--
-- Name: leases leases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_pkey PRIMARY KEY (id);


--
-- Name: onboarding_tasks onboarding_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_pkey PRIMARY KEY (id);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: pay_runs pay_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_runs
    ADD CONSTRAINT pay_runs_pkey PRIMARY KEY (id);


--
-- Name: pay_stubs pay_stubs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_stubs
    ADD CONSTRAINT pay_stubs_pkey PRIMARY KEY (id);


--
-- Name: payment_terms payment_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_terms
    ADD CONSTRAINT payment_terms_pkey PRIMARY KEY (id);


--
-- Name: pricing_plans pricing_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plans
    ADD CONSTRAINT pricing_plans_pkey PRIMARY KEY (id);


--
-- Name: product_price_history product_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_history
    ADD CONSTRAINT product_price_history_pkey PRIMARY KEY (id);


--
-- Name: products_services products_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_services
    ADD CONSTRAINT products_services_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: purchase_order_lines purchase_order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: quote_lines quote_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_lines
    ADD CONSTRAINT quote_lines_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: recurring_bill_lines recurring_bill_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_bill_lines
    ADD CONSTRAINT recurring_bill_lines_pkey PRIMARY KEY (id);


--
-- Name: recurring_bills recurring_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_bills
    ADD CONSTRAINT recurring_bills_pkey PRIMARY KEY (id);


--
-- Name: recurring_invoice_lines recurring_invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_invoice_lines
    ADD CONSTRAINT recurring_invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: recurring_invoices recurring_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_invoices
    ADD CONSTRAINT recurring_invoices_pkey PRIMARY KEY (id);


--
-- Name: remittances remittances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remittances
    ADD CONSTRAINT remittances_pkey PRIMARY KEY (id);


--
-- Name: roe_records roe_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roe_records
    ADD CONSTRAINT roe_records_pkey PRIMARY KEY (id);


--
-- Name: sales_tax_settings sales_tax_settings_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_tax_settings
    ADD CONSTRAINT sales_tax_settings_organization_id_key UNIQUE (organization_id);


--
-- Name: sales_tax_settings sales_tax_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_tax_settings
    ADD CONSTRAINT sales_tax_settings_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: tax_codes tax_codes_organization_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_codes
    ADD CONSTRAINT tax_codes_organization_id_code_key UNIQUE (organization_id, code);


--
-- Name: tax_codes tax_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_codes
    ADD CONSTRAINT tax_codes_pkey PRIMARY KEY (id);


--
-- Name: tax_returns tax_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_returns
    ADD CONSTRAINT tax_returns_pkey PRIMARY KEY (id);


--
-- Name: tax_slips tax_slips_employee_id_tax_year_slip_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_slips
    ADD CONSTRAINT tax_slips_employee_id_tax_year_slip_type_key UNIQUE (employee_id, tax_year, slip_type);


--
-- Name: tax_slips tax_slips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_slips
    ADD CONSTRAINT tax_slips_pkey PRIMARY KEY (id);


--
-- Name: transaction_rules transaction_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_rules
    ADD CONSTRAINT transaction_rules_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_id_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_organization_id_key UNIQUE (user_id, organization_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: vendor_credit_lines vendor_credit_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_credit_lines
    ADD CONSTRAINT vendor_credit_lines_pkey PRIMARY KEY (id);


--
-- Name: vendor_credits vendor_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_credits
    ADD CONSTRAINT vendor_credits_pkey PRIMARY KEY (id);


--
-- Name: vendor_payments vendor_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: idx_accounts_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_classification ON public.accounts USING btree (account_class, account_group, is_current);


--
-- Name: idx_accounts_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_organization ON public.accounts USING btree (organization_id);


--
-- Name: idx_accounts_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_parent ON public.accounts USING btree (parent_id);


--
-- Name: idx_accounts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_type ON public.accounts USING btree (account_type);


--
-- Name: idx_bank_accounts_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_accounts_organization ON public.bank_accounts USING btree (organization_id);


--
-- Name: idx_bank_reconciliations_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_reconciliations_account ON public.bank_reconciliations USING btree (bank_account_id);


--
-- Name: idx_bank_transactions_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_account ON public.bank_transactions USING btree (bank_account_id);


--
-- Name: idx_bank_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_date ON public.bank_transactions USING btree (transaction_date);


--
-- Name: idx_bank_transactions_payee_payor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_payee_payor ON public.bank_transactions USING btree (payee_payor);


--
-- Name: idx_bank_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_status ON public.bank_transactions USING btree (status);


--
-- Name: idx_bill_lines_bill; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bill_lines_bill ON public.bill_lines USING btree (bill_id);


--
-- Name: idx_bills_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bills_due_date ON public.bills USING btree (due_date);


--
-- Name: idx_bills_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bills_organization ON public.bills USING btree (organization_id);


--
-- Name: idx_bills_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bills_status ON public.bills USING btree (status);


--
-- Name: idx_bills_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bills_vendor ON public.bills USING btree (vendor_id);


--
-- Name: idx_cc_reconciliations_card_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cc_reconciliations_card_status ON public.credit_card_reconciliations USING btree (credit_card_id, status);


--
-- Name: idx_compilation_reports_fiscal_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compilation_reports_fiscal_year ON public.compilation_reports USING btree (fiscal_year);


--
-- Name: idx_compilation_reports_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compilation_reports_org_id ON public.compilation_reports USING btree (organization_id);


--
-- Name: idx_customer_payments_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_payments_customer ON public.customer_payments USING btree (customer_id);


--
-- Name: idx_customer_payments_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_payments_invoice ON public.customer_payments USING btree (invoice_id);


--
-- Name: idx_customer_payments_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_payments_organization ON public.customer_payments USING btree (organization_id);


--
-- Name: idx_customers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_email ON public.customers USING btree (email);


--
-- Name: idx_customers_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_organization ON public.customers USING btree (organization_id);


--
-- Name: idx_depreciation_entries_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_entries_asset ON public.depreciation_entries USING btree (asset_id);


--
-- Name: idx_depreciation_entries_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_depreciation_entries_period ON public.depreciation_entries USING btree (period_start, period_end);


--
-- Name: idx_fiscal_periods_org_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fiscal_periods_org_dates ON public.fiscal_periods USING btree (organization_id, start_date, end_date);


--
-- Name: idx_fixed_assets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fixed_assets_category ON public.fixed_assets USING btree (category_id);


--
-- Name: idx_fixed_assets_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fixed_assets_org ON public.fixed_assets USING btree (organization_id);


--
-- Name: idx_fixed_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fixed_assets_status ON public.fixed_assets USING btree (status);


--
-- Name: idx_inventory_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_category ON public.inventory_items USING btree (category_id);


--
-- Name: idx_inventory_items_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_org ON public.inventory_items USING btree (organization_id);


--
-- Name: idx_inventory_items_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_items_sku ON public.inventory_items USING btree (sku);


--
-- Name: idx_inventory_lots_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_lots_item ON public.inventory_lots USING btree (item_id);


--
-- Name: idx_inventory_lots_remaining; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_lots_remaining ON public.inventory_lots USING btree (item_id, quantity_remaining) WHERE (quantity_remaining > (0)::numeric);


--
-- Name: idx_inventory_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_date ON public.inventory_transactions USING btree (transaction_date);


--
-- Name: idx_inventory_transactions_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_item ON public.inventory_transactions USING btree (item_id);


--
-- Name: idx_invoice_lines_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines USING btree (invoice_id);


--
-- Name: idx_invoices_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_customer ON public.invoices USING btree (customer_id);


--
-- Name: idx_invoices_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_date ON public.invoices USING btree (invoice_date);


--
-- Name: idx_invoices_number_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_invoices_number_org ON public.invoices USING btree (organization_id, invoice_number);


--
-- Name: idx_invoices_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_organization ON public.invoices USING btree (organization_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_journal_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_date ON public.journal_entries USING btree (entry_date);


--
-- Name: idx_journal_entries_org_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_org_date ON public.journal_entries USING btree (organization_id, entry_date);


--
-- Name: idx_journal_entries_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_organization ON public.journal_entries USING btree (organization_id);


--
-- Name: idx_journal_entries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_status ON public.journal_entries USING btree (status);


--
-- Name: idx_journal_entry_lines_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entry_lines_account ON public.journal_entry_lines USING btree (account_id);


--
-- Name: idx_journal_entry_lines_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entry_lines_entry ON public.journal_entry_lines USING btree (journal_entry_id);


--
-- Name: idx_lease_modifications_lease; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lease_modifications_lease ON public.lease_modifications USING btree (lease_id);


--
-- Name: idx_lease_payment_schedule_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lease_payment_schedule_date ON public.lease_payment_schedule USING btree (payment_date);


--
-- Name: idx_lease_payment_schedule_lease; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lease_payment_schedule_lease ON public.lease_payment_schedule USING btree (lease_id);


--
-- Name: idx_leases_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leases_organization ON public.leases USING btree (organization_id);


--
-- Name: idx_leases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leases_status ON public.leases USING btree (status);


--
-- Name: idx_products_services_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_services_org ON public.products_services USING btree (organization_id);


--
-- Name: idx_products_services_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_services_type ON public.products_services USING btree (type);


--
-- Name: idx_transaction_rules_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transaction_rules_organization ON public.transaction_rules USING btree (organization_id);


--
-- Name: idx_vendor_payments_bill; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_payments_bill ON public.vendor_payments USING btree (bill_id);


--
-- Name: idx_vendor_payments_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_payments_organization ON public.vendor_payments USING btree (organization_id);


--
-- Name: idx_vendor_payments_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_payments_vendor ON public.vendor_payments USING btree (vendor_id);


--
-- Name: idx_vendors_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_name ON public.vendors USING btree (name);


--
-- Name: idx_vendors_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_organization ON public.vendors USING btree (organization_id);


--
-- Name: journal_entry_lines trigger_prevent_posted_line_modification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_prevent_posted_line_modification BEFORE DELETE OR UPDATE ON public.journal_entry_lines FOR EACH ROW EXECUTE FUNCTION public.prevent_posted_entry_modification();


--
-- Name: bank_transactions trigger_prevent_reconciled_bank_transaction; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_prevent_reconciled_bank_transaction BEFORE DELETE OR UPDATE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.prevent_reconciled_bank_transaction_modification();


--
-- Name: credit_card_transactions trigger_prevent_reconciled_cc_transaction; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_prevent_reconciled_cc_transaction BEFORE DELETE OR UPDATE ON public.credit_card_transactions FOR EACH ROW EXECUTE FUNCTION public.prevent_reconciled_cc_transaction_modification();


--
-- Name: inventory_transactions trigger_update_inventory_average_cost; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_inventory_average_cost AFTER INSERT ON public.inventory_transactions FOR EACH ROW EXECUTE FUNCTION public.update_inventory_average_cost();


--
-- Name: journal_entry_lines trigger_validate_journal_balance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_validate_journal_balance AFTER INSERT OR UPDATE ON public.journal_entry_lines FOR EACH ROW EXECUTE FUNCTION public.validate_journal_entry_balance();


--
-- Name: journal_entries trigger_validate_journal_completeness; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_validate_journal_completeness BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.validate_journal_entry_completeness();


--
-- Name: journal_entry_lines trigger_validate_journal_line_organization; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_validate_journal_line_organization BEFORE INSERT ON public.journal_entry_lines FOR EACH ROW EXECUTE FUNCTION public.validate_journal_line_organization();


--
-- Name: accounts update_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: approval_requests update_approval_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: approval_workflows update_approval_workflows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON public.approval_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bank_accounts update_bank_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bank_reconciliations update_bank_reconciliations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bank_reconciliations_updated_at BEFORE UPDATE ON public.bank_reconciliations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bank_transactions update_bank_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bank_transactions_updated_at BEFORE UPDATE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bills update_bills_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: compilation_reports update_compilation_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_compilation_reports_updated_at BEFORE UPDATE ON public.compilation_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: credit_card_reconciliations update_credit_card_reconciliations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_credit_card_reconciliations_updated_at BEFORE UPDATE ON public.credit_card_reconciliations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: credit_card_transactions update_credit_card_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_credit_card_transactions_updated_at BEFORE UPDATE ON public.credit_card_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: credit_cards update_credit_cards_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_credit_cards_updated_at BEFORE UPDATE ON public.credit_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: credit_notes update_credit_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_credit_notes_updated_at BEFORE UPDATE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: currencies update_currencies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON public.currencies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customer_payments update_customer_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customer_payments_updated_at BEFORE UPDATE ON public.customer_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employee_td1 update_employee_td1_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_employee_td1_updated_at BEFORE UPDATE ON public.employee_td1 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employees update_employees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: expense_claims update_expense_claims_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_expense_claims_updated_at BEFORE UPDATE ON public.expense_claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: fixed_asset_categories update_fixed_asset_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_fixed_asset_categories_updated_at BEFORE UPDATE ON public.fixed_asset_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: fixed_assets update_fixed_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_fixed_assets_updated_at BEFORE UPDATE ON public.fixed_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory_adjustments update_inventory_adjustments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_inventory_adjustments_updated_at BEFORE UPDATE ON public.inventory_adjustments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory_categories update_inventory_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_inventory_categories_updated_at BEFORE UPDATE ON public.inventory_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory_items update_inventory_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: journal_entries update_journal_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lease_categories update_lease_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lease_categories_updated_at BEFORE UPDATE ON public.lease_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leases update_leases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_leases_updated_at BEFORE UPDATE ON public.leases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: onboarding_tasks update_onboarding_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_onboarding_tasks_updated_at BEFORE UPDATE ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pay_runs update_pay_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pay_runs_updated_at BEFORE UPDATE ON public.pay_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_terms update_payment_terms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_terms_updated_at BEFORE UPDATE ON public.payment_terms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pricing_plans update_pricing_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pricing_plans_updated_at BEFORE UPDATE ON public.pricing_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products_services update_products_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_services_updated_at BEFORE UPDATE ON public.products_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: purchase_orders update_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quotes update_quotes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: recurring_bills update_recurring_bills_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_recurring_bills_updated_at BEFORE UPDATE ON public.recurring_bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: recurring_invoices update_recurring_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_recurring_invoices_updated_at BEFORE UPDATE ON public.recurring_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: remittances update_remittances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_remittances_updated_at BEFORE UPDATE ON public.remittances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: roe_records update_roe_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_roe_records_updated_at BEFORE UPDATE ON public.roe_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales_tax_settings update_sales_tax_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sales_tax_settings_updated_at BEFORE UPDATE ON public.sales_tax_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tax_codes update_tax_codes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tax_codes_updated_at BEFORE UPDATE ON public.tax_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tax_returns update_tax_returns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tax_returns_updated_at BEFORE UPDATE ON public.tax_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tax_slips update_tax_slips_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tax_slips_updated_at BEFORE UPDATE ON public.tax_slips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: transaction_rules update_transaction_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_transaction_rules_updated_at BEFORE UPDATE ON public.transaction_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_preferences update_user_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendor_credits update_vendor_credits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vendor_credits_updated_at BEFORE UPDATE ON public.vendor_credits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendor_payments update_vendor_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vendor_payments_updated_at BEFORE UPDATE ON public.vendor_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendors update_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: accounts accounts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: accounts accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: approval_actions approval_actions_approval_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_actions
    ADD CONSTRAINT approval_actions_approval_request_id_fkey FOREIGN KEY (approval_request_id) REFERENCES public.approval_requests(id) ON DELETE CASCADE;


--
-- Name: approval_requests approval_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: approval_requests approval_requests_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id);


--
-- Name: approval_workflow_steps approval_workflow_steps_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflow_steps
    ADD CONSTRAINT approval_workflow_steps_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id) ON DELETE CASCADE;


--
-- Name: approval_workflows approval_workflows_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: bank_accounts bank_accounts_gl_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_gl_account_id_fkey FOREIGN KEY (gl_account_id) REFERENCES public.accounts(id);


--
-- Name: bank_accounts bank_accounts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: bank_reconciliations bank_reconciliations_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: bank_transactions bank_transactions_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: bank_transactions bank_transactions_gl_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_gl_account_id_fkey FOREIGN KEY (gl_account_id) REFERENCES public.accounts(id);


--
-- Name: bank_transactions bank_transactions_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: bill_lines bill_lines_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_lines
    ADD CONSTRAINT bill_lines_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;


--
-- Name: bill_lines bill_lines_expense_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_lines
    ADD CONSTRAINT bill_lines_expense_account_id_fkey FOREIGN KEY (expense_account_id) REFERENCES public.accounts(id);


--
-- Name: bills bills_ap_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_ap_account_id_fkey FOREIGN KEY (ap_account_id) REFERENCES public.accounts(id);


--
-- Name: bills bills_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: bills bills_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: bills bills_payment_terms_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_payment_terms_id_fkey FOREIGN KEY (payment_terms_id) REFERENCES public.payment_terms(id);


--
-- Name: bills bills_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: bills bills_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: compilation_reports compilation_reports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compilation_reports
    ADD CONSTRAINT compilation_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: compilation_reports compilation_reports_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compilation_reports
    ADD CONSTRAINT compilation_reports_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: cost_allocations cost_allocations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_allocations
    ADD CONSTRAINT cost_allocations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: cost_allocations cost_allocations_product_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_allocations
    ADD CONSTRAINT cost_allocations_product_service_id_fkey FOREIGN KEY (product_service_id) REFERENCES public.products_services(id) ON DELETE CASCADE;


--
-- Name: credit_card_reconciliations credit_card_reconciliations_credit_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_card_reconciliations
    ADD CONSTRAINT credit_card_reconciliations_credit_card_id_fkey FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id) ON DELETE CASCADE;


--
-- Name: credit_card_transactions credit_card_transactions_credit_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_credit_card_id_fkey FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id) ON DELETE CASCADE;


--
-- Name: credit_card_transactions credit_card_transactions_gl_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_gl_account_id_fkey FOREIGN KEY (gl_account_id) REFERENCES public.accounts(id);


--
-- Name: credit_card_transactions credit_card_transactions_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: credit_cards credit_cards_gl_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_cards
    ADD CONSTRAINT credit_cards_gl_account_id_fkey FOREIGN KEY (gl_account_id) REFERENCES public.accounts(id);


--
-- Name: credit_cards credit_cards_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_cards
    ADD CONSTRAINT credit_cards_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: credit_note_lines credit_note_lines_credit_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_note_lines
    ADD CONSTRAINT credit_note_lines_credit_note_id_fkey FOREIGN KEY (credit_note_id) REFERENCES public.credit_notes(id) ON DELETE CASCADE;


--
-- Name: credit_notes credit_notes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: credit_notes credit_notes_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: credit_notes credit_notes_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: credit_notes credit_notes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: currencies currencies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: customer_payments customer_payments_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id);


--
-- Name: customer_payments customer_payments_bank_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_bank_transaction_id_fkey FOREIGN KEY (bank_transaction_id) REFERENCES public.bank_transactions(id);


--
-- Name: customer_payments customer_payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_payments customer_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: customer_payments customer_payments_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: customer_payments customer_payments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments
    ADD CONSTRAINT customer_payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: customer_statements customer_statements_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_statements
    ADD CONSTRAINT customer_statements_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_statements customer_statements_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_statements
    ADD CONSTRAINT customer_statements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: customers customers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: depreciation_entries depreciation_entries_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_entries
    ADD CONSTRAINT depreciation_entries_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id) ON DELETE CASCADE;


--
-- Name: depreciation_entries depreciation_entries_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciation_entries
    ADD CONSTRAINT depreciation_entries_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: employee_td1 employee_td1_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_td1
    ADD CONSTRAINT employee_td1_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employees employees_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id);


--
-- Name: exchange_rates exchange_rates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: expense_claim_lines expense_claim_lines_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claim_lines
    ADD CONSTRAINT expense_claim_lines_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: expense_claim_lines expense_claim_lines_expense_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claim_lines
    ADD CONSTRAINT expense_claim_lines_expense_account_id_fkey FOREIGN KEY (expense_account_id) REFERENCES public.accounts(id);


--
-- Name: expense_claim_lines expense_claim_lines_expense_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claim_lines
    ADD CONSTRAINT expense_claim_lines_expense_claim_id_fkey FOREIGN KEY (expense_claim_id) REFERENCES public.expense_claims(id) ON DELETE CASCADE;


--
-- Name: expense_claims expense_claims_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: expense_claims expense_claims_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: expense_claims expense_claims_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: fiscal_periods fiscal_periods_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: fixed_asset_categories fixed_asset_categories_accumulated_depreciation_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_asset_categories
    ADD CONSTRAINT fixed_asset_categories_accumulated_depreciation_account_id_fkey FOREIGN KEY (accumulated_depreciation_account_id) REFERENCES public.accounts(id);


--
-- Name: fixed_asset_categories fixed_asset_categories_asset_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_asset_categories
    ADD CONSTRAINT fixed_asset_categories_asset_account_id_fkey FOREIGN KEY (asset_account_id) REFERENCES public.accounts(id);


--
-- Name: fixed_asset_categories fixed_asset_categories_depreciation_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_asset_categories
    ADD CONSTRAINT fixed_asset_categories_depreciation_account_id_fkey FOREIGN KEY (depreciation_account_id) REFERENCES public.accounts(id);


--
-- Name: fixed_asset_categories fixed_asset_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_asset_categories
    ADD CONSTRAINT fixed_asset_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: fixed_assets fixed_assets_accumulated_depreciation_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_accumulated_depreciation_account_id_fkey FOREIGN KEY (accumulated_depreciation_account_id) REFERENCES public.accounts(id);


--
-- Name: fixed_assets fixed_assets_asset_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_asset_account_id_fkey FOREIGN KEY (asset_account_id) REFERENCES public.accounts(id);


--
-- Name: fixed_assets fixed_assets_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id);


--
-- Name: fixed_assets fixed_assets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.fixed_asset_categories(id);


--
-- Name: fixed_assets fixed_assets_depreciation_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_depreciation_account_id_fkey FOREIGN KEY (depreciation_account_id) REFERENCES public.accounts(id);


--
-- Name: fixed_assets fixed_assets_disposal_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_disposal_journal_entry_id_fkey FOREIGN KEY (disposal_journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: fixed_assets fixed_assets_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: fixed_assets fixed_assets_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: inventory_adjustment_lines inventory_adjustment_lines_adjustment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustment_lines
    ADD CONSTRAINT inventory_adjustment_lines_adjustment_id_fkey FOREIGN KEY (adjustment_id) REFERENCES public.inventory_adjustments(id) ON DELETE CASCADE;


--
-- Name: inventory_adjustment_lines inventory_adjustment_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustment_lines
    ADD CONSTRAINT inventory_adjustment_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id);


--
-- Name: inventory_adjustments inventory_adjustments_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: inventory_adjustments inventory_adjustments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: inventory_categories inventory_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: inventory_categories inventory_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.inventory_categories(id);


--
-- Name: inventory_items inventory_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.inventory_categories(id);


--
-- Name: inventory_items inventory_items_cogs_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_cogs_account_id_fkey FOREIGN KEY (cogs_account_id) REFERENCES public.accounts(id);


--
-- Name: inventory_items inventory_items_income_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_income_account_id_fkey FOREIGN KEY (income_account_id) REFERENCES public.accounts(id);


--
-- Name: inventory_items inventory_items_inventory_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_inventory_account_id_fkey FOREIGN KEY (inventory_account_id) REFERENCES public.accounts(id);


--
-- Name: inventory_items inventory_items_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: inventory_lots inventory_lots_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lots
    ADD CONSTRAINT inventory_lots_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_transactions inventory_transactions_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id);


--
-- Name: inventory_transactions inventory_transactions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: inventory_transactions inventory_transactions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id);


--
-- Name: inventory_transactions inventory_transactions_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: inventory_transactions inventory_transactions_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.inventory_lots(id);


--
-- Name: inventory_transactions inventory_transactions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: inventory_valuations inventory_valuations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_valuations
    ADD CONSTRAINT inventory_valuations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invoice_lines invoice_lines_income_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_income_account_id_fkey FOREIGN KEY (income_account_id) REFERENCES public.accounts(id);


--
-- Name: invoice_lines invoice_lines_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_ar_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_ar_account_id_fkey FOREIGN KEY (ar_account_id) REFERENCES public.accounts(id);


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: invoices invoices_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_payment_terms_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_payment_terms_id_fkey FOREIGN KEY (payment_terms_id) REFERENCES public.payment_terms(id);


--
-- Name: journal_entries journal_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: journal_entries journal_entries_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: journal_entries journal_entries_posted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES auth.users(id);


--
-- Name: journal_entries journal_entries_reversal_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_reversal_of_fkey FOREIGN KEY (reversal_of) REFERENCES public.journal_entries(id);


--
-- Name: journal_entries journal_entries_reversed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_reversed_by_fkey FOREIGN KEY (reversed_by) REFERENCES auth.users(id);


--
-- Name: journal_entry_lines journal_entry_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: journal_entry_lines journal_entry_lines_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: lease_categories lease_categories_accumulated_depreciation_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_categories
    ADD CONSTRAINT lease_categories_accumulated_depreciation_account_id_fkey FOREIGN KEY (accumulated_depreciation_account_id) REFERENCES public.accounts(id);


--
-- Name: lease_categories lease_categories_depreciation_expense_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_categories
    ADD CONSTRAINT lease_categories_depreciation_expense_account_id_fkey FOREIGN KEY (depreciation_expense_account_id) REFERENCES public.accounts(id);


--
-- Name: lease_categories lease_categories_interest_expense_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_categories
    ADD CONSTRAINT lease_categories_interest_expense_account_id_fkey FOREIGN KEY (interest_expense_account_id) REFERENCES public.accounts(id);


--
-- Name: lease_categories lease_categories_lease_liability_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_categories
    ADD CONSTRAINT lease_categories_lease_liability_account_id_fkey FOREIGN KEY (lease_liability_account_id) REFERENCES public.accounts(id);


--
-- Name: lease_categories lease_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_categories
    ADD CONSTRAINT lease_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: lease_categories lease_categories_rou_asset_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_categories
    ADD CONSTRAINT lease_categories_rou_asset_account_id_fkey FOREIGN KEY (rou_asset_account_id) REFERENCES public.accounts(id);


--
-- Name: lease_modifications lease_modifications_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_modifications
    ADD CONSTRAINT lease_modifications_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: lease_modifications lease_modifications_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_modifications
    ADD CONSTRAINT lease_modifications_lease_id_fkey FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;


--
-- Name: lease_payment_schedule lease_payment_schedule_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_payment_schedule
    ADD CONSTRAINT lease_payment_schedule_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: lease_payment_schedule lease_payment_schedule_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lease_payment_schedule
    ADD CONSTRAINT lease_payment_schedule_lease_id_fkey FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;


--
-- Name: leases leases_accumulated_depreciation_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_accumulated_depreciation_account_id_fkey FOREIGN KEY (accumulated_depreciation_account_id) REFERENCES public.accounts(id);


--
-- Name: leases leases_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.lease_categories(id);


--
-- Name: leases leases_commencement_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_commencement_journal_id_fkey FOREIGN KEY (commencement_journal_id) REFERENCES public.journal_entries(id);


--
-- Name: leases leases_depreciation_expense_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_depreciation_expense_account_id_fkey FOREIGN KEY (depreciation_expense_account_id) REFERENCES public.accounts(id);


--
-- Name: leases leases_interest_expense_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_interest_expense_account_id_fkey FOREIGN KEY (interest_expense_account_id) REFERENCES public.accounts(id);


--
-- Name: leases leases_lease_liability_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_lease_liability_account_id_fkey FOREIGN KEY (lease_liability_account_id) REFERENCES public.accounts(id);


--
-- Name: leases leases_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: leases leases_rou_asset_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_rou_asset_account_id_fkey FOREIGN KEY (rou_asset_account_id) REFERENCES public.accounts(id);


--
-- Name: onboarding_tasks onboarding_tasks_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: pay_stubs pay_stubs_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_stubs
    ADD CONSTRAINT pay_stubs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: pay_stubs pay_stubs_pay_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_stubs
    ADD CONSTRAINT pay_stubs_pay_run_id_fkey FOREIGN KEY (pay_run_id) REFERENCES public.pay_runs(id) ON DELETE CASCADE;


--
-- Name: payment_terms payment_terms_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_terms
    ADD CONSTRAINT payment_terms_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: product_price_history product_price_history_product_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_history
    ADD CONSTRAINT product_price_history_product_service_id_fkey FOREIGN KEY (product_service_id) REFERENCES public.products_services(id) ON DELETE CASCADE;


--
-- Name: products_services products_services_expense_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_services
    ADD CONSTRAINT products_services_expense_account_id_fkey FOREIGN KEY (expense_account_id) REFERENCES public.accounts(id);


--
-- Name: products_services products_services_income_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_services
    ADD CONSTRAINT products_services_income_account_id_fkey FOREIGN KEY (income_account_id) REFERENCES public.accounts(id);


--
-- Name: products_services products_services_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_services
    ADD CONSTRAINT products_services_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: products_services products_services_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_services
    ADD CONSTRAINT products_services_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: purchase_order_lines purchase_order_lines_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: purchase_order_lines purchase_order_lines_product_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_product_service_id_fkey FOREIGN KEY (product_service_id) REFERENCES public.products_services(id);


--
-- Name: purchase_order_lines purchase_order_lines_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: quote_lines quote_lines_product_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_lines
    ADD CONSTRAINT quote_lines_product_service_id_fkey FOREIGN KEY (product_service_id) REFERENCES public.products_services(id);


--
-- Name: quote_lines quote_lines_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_lines
    ADD CONSTRAINT quote_lines_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_converted_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_converted_invoice_id_fkey FOREIGN KEY (converted_invoice_id) REFERENCES public.invoices(id);


--
-- Name: quotes quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: quotes quotes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: recurring_bill_lines recurring_bill_lines_expense_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_bill_lines
    ADD CONSTRAINT recurring_bill_lines_expense_account_id_fkey FOREIGN KEY (expense_account_id) REFERENCES public.accounts(id);


--
-- Name: recurring_bill_lines recurring_bill_lines_recurring_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_bill_lines
    ADD CONSTRAINT recurring_bill_lines_recurring_bill_id_fkey FOREIGN KEY (recurring_bill_id) REFERENCES public.recurring_bills(id) ON DELETE CASCADE;


--
-- Name: recurring_bills recurring_bills_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_bills
    ADD CONSTRAINT recurring_bills_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: recurring_bills recurring_bills_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_bills
    ADD CONSTRAINT recurring_bills_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: recurring_invoice_lines recurring_invoice_lines_product_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_invoice_lines
    ADD CONSTRAINT recurring_invoice_lines_product_service_id_fkey FOREIGN KEY (product_service_id) REFERENCES public.products_services(id);


--
-- Name: recurring_invoice_lines recurring_invoice_lines_recurring_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_invoice_lines
    ADD CONSTRAINT recurring_invoice_lines_recurring_invoice_id_fkey FOREIGN KEY (recurring_invoice_id) REFERENCES public.recurring_invoices(id) ON DELETE CASCADE;


--
-- Name: recurring_invoices recurring_invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_invoices
    ADD CONSTRAINT recurring_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: recurring_invoices recurring_invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_invoices
    ADD CONSTRAINT recurring_invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: roe_records roe_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roe_records
    ADD CONSTRAINT roe_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: sales_tax_settings sales_tax_settings_gst_collected_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_tax_settings
    ADD CONSTRAINT sales_tax_settings_gst_collected_account_id_fkey FOREIGN KEY (gst_collected_account_id) REFERENCES public.accounts(id);


--
-- Name: sales_tax_settings sales_tax_settings_gst_paid_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_tax_settings
    ADD CONSTRAINT sales_tax_settings_gst_paid_account_id_fkey FOREIGN KEY (gst_paid_account_id) REFERENCES public.accounts(id);


--
-- Name: sales_tax_settings sales_tax_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_tax_settings
    ADD CONSTRAINT sales_tax_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sales_tax_settings sales_tax_settings_pst_collected_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_tax_settings
    ADD CONSTRAINT sales_tax_settings_pst_collected_account_id_fkey FOREIGN KEY (pst_collected_account_id) REFERENCES public.accounts(id);


--
-- Name: sales_tax_settings sales_tax_settings_pst_paid_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_tax_settings
    ADD CONSTRAINT sales_tax_settings_pst_paid_account_id_fkey FOREIGN KEY (pst_paid_account_id) REFERENCES public.accounts(id);


--
-- Name: subscriptions subscriptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.pricing_plans(id) ON DELETE SET NULL;


--
-- Name: tax_codes tax_codes_gl_collected_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_codes
    ADD CONSTRAINT tax_codes_gl_collected_account_id_fkey FOREIGN KEY (gl_collected_account_id) REFERENCES public.accounts(id);


--
-- Name: tax_codes tax_codes_gl_paid_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_codes
    ADD CONSTRAINT tax_codes_gl_paid_account_id_fkey FOREIGN KEY (gl_paid_account_id) REFERENCES public.accounts(id);


--
-- Name: tax_codes tax_codes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_codes
    ADD CONSTRAINT tax_codes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: tax_returns tax_returns_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_returns
    ADD CONSTRAINT tax_returns_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: tax_returns tax_returns_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_returns
    ADD CONSTRAINT tax_returns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: tax_slips tax_slips_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_slips
    ADD CONSTRAINT tax_slips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: transaction_rules transaction_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_rules
    ADD CONSTRAINT transaction_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vendor_credit_lines vendor_credit_lines_expense_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_credit_lines
    ADD CONSTRAINT vendor_credit_lines_expense_account_id_fkey FOREIGN KEY (expense_account_id) REFERENCES public.accounts(id);


--
-- Name: vendor_credit_lines vendor_credit_lines_vendor_credit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_credit_lines
    ADD CONSTRAINT vendor_credit_lines_vendor_credit_id_fkey FOREIGN KEY (vendor_credit_id) REFERENCES public.vendor_credits(id) ON DELETE CASCADE;


--
-- Name: vendor_credits vendor_credits_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_credits
    ADD CONSTRAINT vendor_credits_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id);


--
-- Name: vendor_credits vendor_credits_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_credits
    ADD CONSTRAINT vendor_credits_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: vendor_credits vendor_credits_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_credits
    ADD CONSTRAINT vendor_credits_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: vendor_credits vendor_credits_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_credits
    ADD CONSTRAINT vendor_credits_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: vendor_payments vendor_payments_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id);


--
-- Name: vendor_payments vendor_payments_bank_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_bank_transaction_id_fkey FOREIGN KEY (bank_transaction_id) REFERENCES public.bank_transactions(id);


--
-- Name: vendor_payments vendor_payments_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id);


--
-- Name: vendor_payments vendor_payments_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: vendor_payments vendor_payments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: vendor_payments vendor_payments_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: vendors vendors_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pricing_plans Admins can manage plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage plans" ON public.pricing_plans USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions Admins can manage subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pricing_plans Anyone can view active plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active plans" ON public.pricing_plans FOR SELECT USING (((is_active = true) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: organizations Authenticated users can create organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: employees Authenticated users can insert employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: onboarding_tasks Authenticated users can manage onboarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage onboarding" ON public.onboarding_tasks TO authenticated USING (true) WITH CHECK (true);


--
-- Name: pay_runs Authenticated users can manage pay_runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage pay_runs" ON public.pay_runs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: pay_stubs Authenticated users can manage pay_stubs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage pay_stubs" ON public.pay_stubs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: remittances Authenticated users can manage remittances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage remittances" ON public.remittances TO authenticated USING (true) WITH CHECK (true);


--
-- Name: roe_records Authenticated users can manage roe; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage roe" ON public.roe_records TO authenticated USING (true) WITH CHECK (true);


--
-- Name: tax_slips Authenticated users can manage tax_slips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage tax_slips" ON public.tax_slips TO authenticated USING (true) WITH CHECK (true);


--
-- Name: employee_td1 Authenticated users can manage td1; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage td1" ON public.employee_td1 TO authenticated USING (true) WITH CHECK (true);


--
-- Name: employees Authenticated users can update employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update employees" ON public.employees FOR UPDATE TO authenticated USING (true);


--
-- Name: employees Authenticated users can view employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view employees" ON public.employees FOR SELECT TO authenticated USING (true);


--
-- Name: organization_members Members can view org members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view org members" ON public.organization_members FOR SELECT USING ((public.is_org_member(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: organizations Members can view their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view their organizations" ON public.organizations FOR SELECT USING (((owner_id = auth.uid()) OR public.is_org_member(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: profiles Org members can view member profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view member profiles" ON public.profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.organization_members om1
     JOIN public.organization_members om2 ON ((om1.organization_id = om2.organization_id)))
  WHERE ((om1.user_id = auth.uid()) AND (om2.user_id = profiles.user_id)))));


--
-- Name: subscriptions Org members can view subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view subscriptions" ON public.subscriptions FOR SELECT USING ((public.is_org_member(auth.uid(), organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: organization_members Org owners can manage members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners can manage members" ON public.organization_members USING (((EXISTS ( SELECT 1
   FROM public.organizations
  WHERE ((organizations.id = organization_members.organization_id) AND (organizations.owner_id = auth.uid())))) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: organizations Owners can update organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update organizations" ON public.organizations FOR UPDATE USING (((owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: roe_records Users can create ROE records in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create ROE records in their organization" ON public.roe_records FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = roe_records.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: accounts Users can create accounts in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create accounts in their organization" ON public.accounts FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_adjustment_lines Users can create adjustment lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create adjustment lines" ON public.inventory_adjustment_lines FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.inventory_adjustments a
  WHERE ((a.id = inventory_adjustment_lines.adjustment_id) AND public.is_org_member(auth.uid(), a.organization_id)))));


--
-- Name: approval_actions Users can create approval actions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create approval actions in their organization" ON public.approval_actions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.approval_requests
  WHERE ((approval_requests.id = approval_actions.approval_request_id) AND public.is_org_member(auth.uid(), approval_requests.organization_id)))));


--
-- Name: approval_requests Users can create approval requests in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create approval requests in their organization" ON public.approval_requests FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: approval_workflow_steps Users can create approval workflow steps in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create approval workflow steps in their organization" ON public.approval_workflow_steps FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.approval_workflows
  WHERE ((approval_workflows.id = approval_workflow_steps.workflow_id) AND public.is_org_member(auth.uid(), approval_workflows.organization_id)))));


--
-- Name: approval_workflows Users can create approval workflows in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create approval workflows in their organization" ON public.approval_workflows FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: fixed_asset_categories Users can create asset categories in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create asset categories in their org" ON public.fixed_asset_categories FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: bank_accounts Users can create bank accounts in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create bank accounts in their organization" ON public.bank_accounts FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: bill_lines Users can create bill lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create bill lines in their organization" ON public.bill_lines FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.bills b
  WHERE ((b.id = bill_lines.bill_id) AND public.is_org_member(b.organization_id, auth.uid())))));


--
-- Name: bills Users can create bills in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create bills in their organization" ON public.bills FOR INSERT WITH CHECK (public.is_org_member(organization_id, auth.uid()));


--
-- Name: compilation_reports Users can create compilation reports for their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create compilation reports for their organizations" ON public.compilation_reports FOR INSERT WITH CHECK ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: credit_card_reconciliations Users can create credit card reconciliations in their organizat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create credit card reconciliations in their organizat" ON public.credit_card_reconciliations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.credit_cards cc
  WHERE ((cc.id = credit_card_reconciliations.credit_card_id) AND public.is_org_member(auth.uid(), cc.organization_id)))));


--
-- Name: credit_card_transactions Users can create credit card transactions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create credit card transactions in their organization" ON public.credit_card_transactions FOR INSERT WITH CHECK ((credit_card_id IN ( SELECT cc.id
   FROM public.credit_cards cc
  WHERE (cc.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE (organization_members.user_id = auth.uid()))))));


--
-- Name: credit_cards Users can create credit cards in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create credit cards in their organization" ON public.credit_cards FOR INSERT WITH CHECK ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: credit_note_lines Users can create credit note lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create credit note lines in their organization" ON public.credit_note_lines FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.credit_notes
  WHERE ((credit_notes.id = credit_note_lines.credit_note_id) AND public.is_org_member(auth.uid(), credit_notes.organization_id)))));


--
-- Name: credit_notes Users can create credit notes in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create credit notes in their organization" ON public.credit_notes FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: currencies Users can create currencies in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create currencies in their organization" ON public.currencies FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: customer_statements Users can create customer statements in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create customer statements in their organization" ON public.customer_statements FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: customers Users can create customers in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create customers in their organization" ON public.customers FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: depreciation_entries Users can create depreciation entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create depreciation entries" ON public.depreciation_entries FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.fixed_assets a
  WHERE ((a.id = depreciation_entries.asset_id) AND public.is_org_member(auth.uid(), a.organization_id)))));


--
-- Name: employee_td1 Users can create employee TD1 in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create employee TD1 in their organization" ON public.employee_td1 FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = employee_td1.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: employees Users can create employees in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create employees in their organization" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: exchange_rates Users can create exchange rates in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create exchange rates in their organization" ON public.exchange_rates FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: expense_claim_lines Users can create expense claim lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create expense claim lines in their organization" ON public.expense_claim_lines FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.expense_claims
  WHERE ((expense_claims.id = expense_claim_lines.expense_claim_id) AND public.is_org_member(auth.uid(), expense_claims.organization_id)))));


--
-- Name: expense_claims Users can create expense claims in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create expense claims in their organization" ON public.expense_claims FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: fiscal_periods Users can create fiscal periods in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create fiscal periods in their org" ON public.fiscal_periods FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: fixed_assets Users can create fixed assets in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create fixed assets in their org" ON public.fixed_assets FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_adjustments Users can create inventory adjustments in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create inventory adjustments in their org" ON public.inventory_adjustments FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_categories Users can create inventory categories in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create inventory categories in their org" ON public.inventory_categories FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_items Users can create inventory items in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create inventory items in their org" ON public.inventory_items FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_lots Users can create inventory lots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create inventory lots" ON public.inventory_lots FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.inventory_items i
  WHERE ((i.id = inventory_lots.item_id) AND public.is_org_member(auth.uid(), i.organization_id)))));


--
-- Name: inventory_transactions Users can create inventory transactions in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create inventory transactions in their org" ON public.inventory_transactions FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: invoice_lines Users can create invoice lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create invoice lines in their organization" ON public.invoice_lines FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.invoices inv
  WHERE ((inv.id = invoice_lines.invoice_id) AND public.is_org_member(auth.uid(), inv.organization_id)))));


--
-- Name: invoices Users can create invoices in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create invoices in their organization" ON public.invoices FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: journal_entries Users can create journal entries in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create journal entries in their organization" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: journal_entry_lines Users can create journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create journal entry lines" ON public.journal_entry_lines FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.journal_entries je
  WHERE ((je.id = journal_entry_lines.journal_entry_id) AND public.is_org_member(auth.uid(), je.organization_id)))));


--
-- Name: lease_categories Users can create lease categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create lease categories" ON public.lease_categories FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: leases Users can create leases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create leases" ON public.leases FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: onboarding_tasks Users can create onboarding tasks in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create onboarding tasks in their organization" ON public.onboarding_tasks FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = onboarding_tasks.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: cost_allocations Users can create own org cost allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own org cost allocations" ON public.cost_allocations FOR INSERT WITH CHECK ((organization_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.owner_id = auth.uid()))));


--
-- Name: inventory_valuations Users can create own org inventory valuations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own org inventory valuations" ON public.inventory_valuations FOR INSERT WITH CHECK ((organization_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.owner_id = auth.uid()))));


--
-- Name: pay_runs Users can create pay runs in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create pay runs in their organization" ON public.pay_runs FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: pay_stubs Users can create pay stubs in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create pay stubs in their organization" ON public.pay_stubs FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.pay_runs
  WHERE ((pay_runs.id = pay_stubs.pay_run_id) AND public.is_org_member(auth.uid(), pay_runs.organization_id)))));


--
-- Name: payment_terms Users can create payment terms in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create payment terms in their organization" ON public.payment_terms FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: customer_payments Users can create payments in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create payments in their organization" ON public.customer_payments FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: products_services Users can create products_services in their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create products_services in their organizations" ON public.products_services FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: purchase_order_lines Users can create purchase order lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create purchase order lines in their organization" ON public.purchase_order_lines FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.purchase_orders
  WHERE ((purchase_orders.id = purchase_order_lines.purchase_order_id) AND public.is_org_member(auth.uid(), purchase_orders.organization_id)))));


--
-- Name: purchase_orders Users can create purchase orders in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create purchase orders in their organization" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: quote_lines Users can create quote lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create quote lines in their organization" ON public.quote_lines FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_lines.quote_id) AND public.is_org_member(auth.uid(), quotes.organization_id)))));


--
-- Name: quotes Users can create quotes in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create quotes in their organization" ON public.quotes FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: bank_reconciliations Users can create reconciliations in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create reconciliations in their organization" ON public.bank_reconciliations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.bank_accounts ba
  WHERE ((ba.id = bank_reconciliations.bank_account_id) AND public.is_org_member(auth.uid(), ba.organization_id)))));


--
-- Name: recurring_bill_lines Users can create recurring bill lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create recurring bill lines in their organization" ON public.recurring_bill_lines FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.recurring_bills
  WHERE ((recurring_bills.id = recurring_bill_lines.recurring_bill_id) AND public.is_org_member(auth.uid(), recurring_bills.organization_id)))));


--
-- Name: recurring_bills Users can create recurring bills in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create recurring bills in their organization" ON public.recurring_bills FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: recurring_invoice_lines Users can create recurring invoice lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create recurring invoice lines in their organization" ON public.recurring_invoice_lines FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.recurring_invoices
  WHERE ((recurring_invoices.id = recurring_invoice_lines.recurring_invoice_id) AND public.is_org_member(auth.uid(), recurring_invoices.organization_id)))));


--
-- Name: recurring_invoices Users can create recurring invoices in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create recurring invoices in their organization" ON public.recurring_invoices FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: remittances Users can create remittances in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create remittances in their organization" ON public.remittances FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: transaction_rules Users can create rules in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create rules in their organization" ON public.transaction_rules FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tax_slips Users can create tax slips in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create tax slips in their organization" ON public.tax_slips FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = tax_slips.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: bank_transactions Users can create transactions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create transactions in their organization" ON public.bank_transactions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.bank_accounts ba
  WHERE ((ba.id = bank_transactions.bank_account_id) AND public.is_org_member(auth.uid(), ba.organization_id)))));


--
-- Name: vendor_credit_lines Users can create vendor credit lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create vendor credit lines in their organization" ON public.vendor_credit_lines FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vendor_credits
  WHERE ((vendor_credits.id = vendor_credit_lines.vendor_credit_id) AND public.is_org_member(auth.uid(), vendor_credits.organization_id)))));


--
-- Name: vendor_credits Users can create vendor credits in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create vendor credits in their organization" ON public.vendor_credits FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: vendor_payments Users can create vendor payments in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create vendor payments in their organization" ON public.vendor_payments FOR INSERT WITH CHECK (public.is_org_member(organization_id, auth.uid()));


--
-- Name: vendors Users can create vendors in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create vendors in their organization" ON public.vendors FOR INSERT WITH CHECK (public.is_org_member(organization_id, auth.uid()));


--
-- Name: roe_records Users can delete ROE records in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete ROE records in their organization" ON public.roe_records FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = roe_records.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: accounts Users can delete accounts in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete accounts in their organization" ON public.accounts FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_adjustment_lines Users can delete adjustment lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete adjustment lines" ON public.inventory_adjustment_lines FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.inventory_adjustments a
  WHERE ((a.id = inventory_adjustment_lines.adjustment_id) AND public.is_org_member(auth.uid(), a.organization_id)))));


--
-- Name: approval_actions Users can delete approval actions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete approval actions in their organization" ON public.approval_actions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.approval_requests
  WHERE ((approval_requests.id = approval_actions.approval_request_id) AND public.is_org_member(auth.uid(), approval_requests.organization_id)))));


--
-- Name: approval_requests Users can delete approval requests in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete approval requests in their organization" ON public.approval_requests FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: approval_workflow_steps Users can delete approval workflow steps in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete approval workflow steps in their organization" ON public.approval_workflow_steps FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.approval_workflows
  WHERE ((approval_workflows.id = approval_workflow_steps.workflow_id) AND public.is_org_member(auth.uid(), approval_workflows.organization_id)))));


--
-- Name: approval_workflows Users can delete approval workflows in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete approval workflows in their organization" ON public.approval_workflows FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: fixed_asset_categories Users can delete asset categories in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete asset categories in their org" ON public.fixed_asset_categories FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: bank_accounts Users can delete bank accounts in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete bank accounts in their organization" ON public.bank_accounts FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: bill_lines Users can delete bill lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete bill lines in their organization" ON public.bill_lines FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.bills b
  WHERE ((b.id = bill_lines.bill_id) AND public.is_org_member(b.organization_id, auth.uid())))));


--
-- Name: bills Users can delete bills in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete bills in their organization" ON public.bills FOR DELETE USING (public.is_org_member(organization_id, auth.uid()));


--
-- Name: compilation_reports Users can delete compilation reports for their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete compilation reports for their organizations" ON public.compilation_reports FOR DELETE USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: credit_card_reconciliations Users can delete credit card reconciliations in their organizat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete credit card reconciliations in their organizat" ON public.credit_card_reconciliations FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.credit_cards cc
  WHERE ((cc.id = credit_card_reconciliations.credit_card_id) AND public.is_org_member(auth.uid(), cc.organization_id)))));


--
-- Name: credit_card_transactions Users can delete credit card transactions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete credit card transactions in their organization" ON public.credit_card_transactions FOR DELETE USING ((credit_card_id IN ( SELECT cc.id
   FROM public.credit_cards cc
  WHERE (cc.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE (organization_members.user_id = auth.uid()))))));


--
-- Name: credit_cards Users can delete credit cards in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete credit cards in their organization" ON public.credit_cards FOR DELETE USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: credit_note_lines Users can delete credit note lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete credit note lines in their organization" ON public.credit_note_lines FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.credit_notes
  WHERE ((credit_notes.id = credit_note_lines.credit_note_id) AND public.is_org_member(auth.uid(), credit_notes.organization_id)))));


--
-- Name: credit_notes Users can delete credit notes in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete credit notes in their organization" ON public.credit_notes FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: currencies Users can delete currencies in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete currencies in their organization" ON public.currencies FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: customer_statements Users can delete customer statements in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete customer statements in their organization" ON public.customer_statements FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: customers Users can delete customers in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete customers in their organization" ON public.customers FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: depreciation_entries Users can delete depreciation entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete depreciation entries" ON public.depreciation_entries FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.fixed_assets a
  WHERE ((a.id = depreciation_entries.asset_id) AND public.is_org_member(auth.uid(), a.organization_id)))));


--
-- Name: employee_td1 Users can delete employee TD1 in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete employee TD1 in their organization" ON public.employee_td1 FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = employee_td1.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: employees Users can delete employees in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete employees in their organization" ON public.employees FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: exchange_rates Users can delete exchange rates in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete exchange rates in their organization" ON public.exchange_rates FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: expense_claim_lines Users can delete expense claim lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete expense claim lines in their organization" ON public.expense_claim_lines FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.expense_claims
  WHERE ((expense_claims.id = expense_claim_lines.expense_claim_id) AND public.is_org_member(auth.uid(), expense_claims.organization_id)))));


--
-- Name: expense_claims Users can delete expense claims in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete expense claims in their organization" ON public.expense_claims FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: fiscal_periods Users can delete fiscal periods in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete fiscal periods in their org" ON public.fiscal_periods FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: fixed_assets Users can delete fixed assets in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete fixed assets in their org" ON public.fixed_assets FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_adjustments Users can delete inventory adjustments in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete inventory adjustments in their org" ON public.inventory_adjustments FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_categories Users can delete inventory categories in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete inventory categories in their org" ON public.inventory_categories FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_items Users can delete inventory items in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete inventory items in their org" ON public.inventory_items FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_lots Users can delete inventory lots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete inventory lots" ON public.inventory_lots FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.inventory_items i
  WHERE ((i.id = inventory_lots.item_id) AND public.is_org_member(auth.uid(), i.organization_id)))));


--
-- Name: inventory_transactions Users can delete inventory transactions in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete inventory transactions in their org" ON public.inventory_transactions FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: invoice_lines Users can delete invoice lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete invoice lines in their organization" ON public.invoice_lines FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.invoices inv
  WHERE ((inv.id = invoice_lines.invoice_id) AND public.is_org_member(auth.uid(), inv.organization_id)))));


--
-- Name: invoices Users can delete invoices in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete invoices in their organization" ON public.invoices FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: journal_entries Users can delete journal entries in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete journal entries in their organization" ON public.journal_entries FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: journal_entry_lines Users can delete journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete journal entry lines" ON public.journal_entry_lines FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.journal_entries je
  WHERE ((je.id = journal_entry_lines.journal_entry_id) AND public.is_org_member(auth.uid(), je.organization_id)))));


--
-- Name: lease_categories Users can delete lease categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete lease categories" ON public.lease_categories FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: leases Users can delete leases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete leases" ON public.leases FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: onboarding_tasks Users can delete onboarding tasks in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete onboarding tasks in their organization" ON public.onboarding_tasks FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = onboarding_tasks.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: cost_allocations Users can delete own org cost allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own org cost allocations" ON public.cost_allocations FOR DELETE USING ((organization_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.owner_id = auth.uid()))));


--
-- Name: pay_runs Users can delete pay runs in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete pay runs in their organization" ON public.pay_runs FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: pay_stubs Users can delete pay stubs in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete pay stubs in their organization" ON public.pay_stubs FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.pay_runs
  WHERE ((pay_runs.id = pay_stubs.pay_run_id) AND public.is_org_member(auth.uid(), pay_runs.organization_id)))));


--
-- Name: payment_terms Users can delete payment terms in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete payment terms in their organization" ON public.payment_terms FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: customer_payments Users can delete payments in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete payments in their organization" ON public.customer_payments FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: products_services Users can delete products_services in their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete products_services in their organizations" ON public.products_services FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: purchase_order_lines Users can delete purchase order lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete purchase order lines in their organization" ON public.purchase_order_lines FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.purchase_orders
  WHERE ((purchase_orders.id = purchase_order_lines.purchase_order_id) AND public.is_org_member(auth.uid(), purchase_orders.organization_id)))));


--
-- Name: purchase_orders Users can delete purchase orders in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete purchase orders in their organization" ON public.purchase_orders FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: quote_lines Users can delete quote lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete quote lines in their organization" ON public.quote_lines FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_lines.quote_id) AND public.is_org_member(auth.uid(), quotes.organization_id)))));


--
-- Name: quotes Users can delete quotes in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete quotes in their organization" ON public.quotes FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: bank_reconciliations Users can delete reconciliations in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete reconciliations in their organization" ON public.bank_reconciliations FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.bank_accounts ba
  WHERE ((ba.id = bank_reconciliations.bank_account_id) AND public.is_org_member(auth.uid(), ba.organization_id)))));


--
-- Name: recurring_bill_lines Users can delete recurring bill lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete recurring bill lines in their organization" ON public.recurring_bill_lines FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.recurring_bills
  WHERE ((recurring_bills.id = recurring_bill_lines.recurring_bill_id) AND public.is_org_member(auth.uid(), recurring_bills.organization_id)))));


--
-- Name: recurring_bills Users can delete recurring bills in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete recurring bills in their organization" ON public.recurring_bills FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: recurring_invoice_lines Users can delete recurring invoice lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete recurring invoice lines in their organization" ON public.recurring_invoice_lines FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.recurring_invoices
  WHERE ((recurring_invoices.id = recurring_invoice_lines.recurring_invoice_id) AND public.is_org_member(auth.uid(), recurring_invoices.organization_id)))));


--
-- Name: recurring_invoices Users can delete recurring invoices in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete recurring invoices in their organization" ON public.recurring_invoices FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: remittances Users can delete remittances in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete remittances in their organization" ON public.remittances FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: transaction_rules Users can delete rules in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete rules in their organization" ON public.transaction_rules FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tax_slips Users can delete tax slips in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete tax slips in their organization" ON public.tax_slips FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = tax_slips.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: tax_codes Users can delete their org tax codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their org tax codes" ON public.tax_codes FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: user_preferences Users can delete their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own preferences" ON public.user_preferences FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: bank_transactions Users can delete transactions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete transactions in their organization" ON public.bank_transactions FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.bank_accounts ba
  WHERE ((ba.id = bank_transactions.bank_account_id) AND public.is_org_member(auth.uid(), ba.organization_id)))));


--
-- Name: vendor_credit_lines Users can delete vendor credit lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete vendor credit lines in their organization" ON public.vendor_credit_lines FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.vendor_credits
  WHERE ((vendor_credits.id = vendor_credit_lines.vendor_credit_id) AND public.is_org_member(auth.uid(), vendor_credits.organization_id)))));


--
-- Name: vendor_credits Users can delete vendor credits in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete vendor credits in their organization" ON public.vendor_credits FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: vendor_payments Users can delete vendor payments in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete vendor payments in their organization" ON public.vendor_payments FOR DELETE USING (public.is_org_member(organization_id, auth.uid()));


--
-- Name: vendors Users can delete vendors in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete vendors in their organization" ON public.vendors FOR DELETE USING (public.is_org_member(organization_id, auth.uid()));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: product_price_history Users can insert product price history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert product price history" ON public.product_price_history FOR INSERT WITH CHECK ((product_service_id IN ( SELECT products_services.id
   FROM public.products_services
  WHERE (products_services.organization_id IN ( SELECT organizations.id
           FROM public.organizations
          WHERE (organizations.owner_id = auth.uid()))))));


--
-- Name: sales_tax_settings Users can insert their org sales tax settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their org sales tax settings" ON public.sales_tax_settings FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tax_codes Users can insert their org tax codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their org tax codes" ON public.tax_codes FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tax_returns Users can insert their org tax returns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their org tax returns" ON public.tax_returns FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: user_preferences Users can insert their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own preferences" ON public.user_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: lease_modifications Users can manage lease modifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage lease modifications" ON public.lease_modifications USING ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE public.is_org_member(auth.uid(), leases.organization_id))));


--
-- Name: lease_payment_schedule Users can manage lease payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage lease payments" ON public.lease_payment_schedule USING ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE public.is_org_member(auth.uid(), leases.organization_id))));


--
-- Name: roe_records Users can update ROE records in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update ROE records in their organization" ON public.roe_records FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = roe_records.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: accounts Users can update accounts in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update accounts in their organization" ON public.accounts FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_adjustment_lines Users can update adjustment lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update adjustment lines" ON public.inventory_adjustment_lines FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.inventory_adjustments a
  WHERE ((a.id = inventory_adjustment_lines.adjustment_id) AND public.is_org_member(auth.uid(), a.organization_id)))));


--
-- Name: approval_actions Users can update approval actions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update approval actions in their organization" ON public.approval_actions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.approval_requests
  WHERE ((approval_requests.id = approval_actions.approval_request_id) AND public.is_org_member(auth.uid(), approval_requests.organization_id)))));


--
-- Name: approval_requests Users can update approval requests in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update approval requests in their organization" ON public.approval_requests FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: approval_workflow_steps Users can update approval workflow steps in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update approval workflow steps in their organization" ON public.approval_workflow_steps FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.approval_workflows
  WHERE ((approval_workflows.id = approval_workflow_steps.workflow_id) AND public.is_org_member(auth.uid(), approval_workflows.organization_id)))));


--
-- Name: approval_workflows Users can update approval workflows in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update approval workflows in their organization" ON public.approval_workflows FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: fixed_asset_categories Users can update asset categories in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update asset categories in their org" ON public.fixed_asset_categories FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: bank_accounts Users can update bank accounts in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update bank accounts in their organization" ON public.bank_accounts FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: bill_lines Users can update bill lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update bill lines in their organization" ON public.bill_lines FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.bills b
  WHERE ((b.id = bill_lines.bill_id) AND public.is_org_member(b.organization_id, auth.uid())))));


--
-- Name: bills Users can update bills in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update bills in their organization" ON public.bills FOR UPDATE USING (public.is_org_member(organization_id, auth.uid()));


--
-- Name: compilation_reports Users can update compilation reports for their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update compilation reports for their organizations" ON public.compilation_reports FOR UPDATE USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: credit_card_reconciliations Users can update credit card reconciliations in their organizat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update credit card reconciliations in their organizat" ON public.credit_card_reconciliations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.credit_cards cc
  WHERE ((cc.id = credit_card_reconciliations.credit_card_id) AND public.is_org_member(auth.uid(), cc.organization_id)))));


--
-- Name: credit_card_transactions Users can update credit card transactions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update credit card transactions in their organization" ON public.credit_card_transactions FOR UPDATE USING ((credit_card_id IN ( SELECT cc.id
   FROM public.credit_cards cc
  WHERE (cc.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE (organization_members.user_id = auth.uid()))))));


--
-- Name: credit_cards Users can update credit cards in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update credit cards in their organization" ON public.credit_cards FOR UPDATE USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: credit_note_lines Users can update credit note lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update credit note lines in their organization" ON public.credit_note_lines FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.credit_notes
  WHERE ((credit_notes.id = credit_note_lines.credit_note_id) AND public.is_org_member(auth.uid(), credit_notes.organization_id)))));


--
-- Name: credit_notes Users can update credit notes in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update credit notes in their organization" ON public.credit_notes FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: currencies Users can update currencies in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update currencies in their organization" ON public.currencies FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: customer_statements Users can update customer statements in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update customer statements in their organization" ON public.customer_statements FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: customers Users can update customers in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update customers in their organization" ON public.customers FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: depreciation_entries Users can update depreciation entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update depreciation entries" ON public.depreciation_entries FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.fixed_assets a
  WHERE ((a.id = depreciation_entries.asset_id) AND public.is_org_member(auth.uid(), a.organization_id)))));


--
-- Name: employee_td1 Users can update employee TD1 in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update employee TD1 in their organization" ON public.employee_td1 FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = employee_td1.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: employees Users can update employees in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update employees in their organization" ON public.employees FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: exchange_rates Users can update exchange rates in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update exchange rates in their organization" ON public.exchange_rates FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: expense_claim_lines Users can update expense claim lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update expense claim lines in their organization" ON public.expense_claim_lines FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.expense_claims
  WHERE ((expense_claims.id = expense_claim_lines.expense_claim_id) AND public.is_org_member(auth.uid(), expense_claims.organization_id)))));


--
-- Name: expense_claims Users can update expense claims in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update expense claims in their organization" ON public.expense_claims FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: fiscal_periods Users can update fiscal periods in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update fiscal periods in their org" ON public.fiscal_periods FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: fixed_assets Users can update fixed assets in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update fixed assets in their org" ON public.fixed_assets FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_adjustments Users can update inventory adjustments in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update inventory adjustments in their org" ON public.inventory_adjustments FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_categories Users can update inventory categories in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update inventory categories in their org" ON public.inventory_categories FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_items Users can update inventory items in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update inventory items in their org" ON public.inventory_items FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_lots Users can update inventory lots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update inventory lots" ON public.inventory_lots FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.inventory_items i
  WHERE ((i.id = inventory_lots.item_id) AND public.is_org_member(auth.uid(), i.organization_id)))));


--
-- Name: inventory_transactions Users can update inventory transactions in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update inventory transactions in their org" ON public.inventory_transactions FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: invoice_lines Users can update invoice lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update invoice lines in their organization" ON public.invoice_lines FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.invoices inv
  WHERE ((inv.id = invoice_lines.invoice_id) AND public.is_org_member(auth.uid(), inv.organization_id)))));


--
-- Name: invoices Users can update invoices in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update invoices in their organization" ON public.invoices FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: journal_entries Users can update journal entries in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update journal entries in their organization" ON public.journal_entries FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: journal_entry_lines Users can update journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update journal entry lines" ON public.journal_entry_lines FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.journal_entries je
  WHERE ((je.id = journal_entry_lines.journal_entry_id) AND public.is_org_member(auth.uid(), je.organization_id)))));


--
-- Name: lease_categories Users can update lease categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update lease categories" ON public.lease_categories FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: leases Users can update leases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update leases" ON public.leases FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: onboarding_tasks Users can update onboarding tasks in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update onboarding tasks in their organization" ON public.onboarding_tasks FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = onboarding_tasks.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: cost_allocations Users can update own org cost allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own org cost allocations" ON public.cost_allocations FOR UPDATE USING ((organization_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.owner_id = auth.uid()))));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: pay_runs Users can update pay runs in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update pay runs in their organization" ON public.pay_runs FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: pay_stubs Users can update pay stubs in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update pay stubs in their organization" ON public.pay_stubs FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.pay_runs
  WHERE ((pay_runs.id = pay_stubs.pay_run_id) AND public.is_org_member(auth.uid(), pay_runs.organization_id)))));


--
-- Name: payment_terms Users can update payment terms in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update payment terms in their organization" ON public.payment_terms FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: customer_payments Users can update payments in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update payments in their organization" ON public.customer_payments FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: products_services Users can update products_services in their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update products_services in their organizations" ON public.products_services FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: purchase_order_lines Users can update purchase order lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update purchase order lines in their organization" ON public.purchase_order_lines FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.purchase_orders
  WHERE ((purchase_orders.id = purchase_order_lines.purchase_order_id) AND public.is_org_member(auth.uid(), purchase_orders.organization_id)))));


--
-- Name: purchase_orders Users can update purchase orders in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update purchase orders in their organization" ON public.purchase_orders FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: quote_lines Users can update quote lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update quote lines in their organization" ON public.quote_lines FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_lines.quote_id) AND public.is_org_member(auth.uid(), quotes.organization_id)))));


--
-- Name: quotes Users can update quotes in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update quotes in their organization" ON public.quotes FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: bank_reconciliations Users can update reconciliations in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update reconciliations in their organization" ON public.bank_reconciliations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.bank_accounts ba
  WHERE ((ba.id = bank_reconciliations.bank_account_id) AND public.is_org_member(auth.uid(), ba.organization_id)))));


--
-- Name: recurring_bill_lines Users can update recurring bill lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update recurring bill lines in their organization" ON public.recurring_bill_lines FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.recurring_bills
  WHERE ((recurring_bills.id = recurring_bill_lines.recurring_bill_id) AND public.is_org_member(auth.uid(), recurring_bills.organization_id)))));


--
-- Name: recurring_bills Users can update recurring bills in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update recurring bills in their organization" ON public.recurring_bills FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: recurring_invoice_lines Users can update recurring invoice lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update recurring invoice lines in their organization" ON public.recurring_invoice_lines FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.recurring_invoices
  WHERE ((recurring_invoices.id = recurring_invoice_lines.recurring_invoice_id) AND public.is_org_member(auth.uid(), recurring_invoices.organization_id)))));


--
-- Name: recurring_invoices Users can update recurring invoices in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update recurring invoices in their organization" ON public.recurring_invoices FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: remittances Users can update remittances in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update remittances in their organization" ON public.remittances FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: transaction_rules Users can update rules in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update rules in their organization" ON public.transaction_rules FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tax_slips Users can update tax slips in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update tax slips in their organization" ON public.tax_slips FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = tax_slips.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: sales_tax_settings Users can update their org sales tax settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their org sales tax settings" ON public.sales_tax_settings FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tax_codes Users can update their org tax codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their org tax codes" ON public.tax_codes FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tax_returns Users can update their org tax returns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their org tax returns" ON public.tax_returns FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: user_preferences Users can update their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own preferences" ON public.user_preferences FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: bank_transactions Users can update transactions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update transactions in their organization" ON public.bank_transactions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.bank_accounts ba
  WHERE ((ba.id = bank_transactions.bank_account_id) AND public.is_org_member(auth.uid(), ba.organization_id)))));


--
-- Name: vendor_credit_lines Users can update vendor credit lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update vendor credit lines in their organization" ON public.vendor_credit_lines FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.vendor_credits
  WHERE ((vendor_credits.id = vendor_credit_lines.vendor_credit_id) AND public.is_org_member(auth.uid(), vendor_credits.organization_id)))));


--
-- Name: vendor_credits Users can update vendor credits in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update vendor credits in their organization" ON public.vendor_credits FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), organization_id)) WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: vendor_payments Users can update vendor payments in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update vendor payments in their organization" ON public.vendor_payments FOR UPDATE USING (public.is_org_member(organization_id, auth.uid()));


--
-- Name: vendors Users can update vendors in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update vendors in their organization" ON public.vendors FOR UPDATE USING (public.is_org_member(organization_id, auth.uid()));


--
-- Name: roe_records Users can view ROE records in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view ROE records in their organization" ON public.roe_records FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = roe_records.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: accounts Users can view accounts in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view accounts in their organization" ON public.accounts FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_adjustment_lines Users can view adjustment lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view adjustment lines" ON public.inventory_adjustment_lines FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.inventory_adjustments a
  WHERE ((a.id = inventory_adjustment_lines.adjustment_id) AND public.is_org_member(auth.uid(), a.organization_id)))));


--
-- Name: approval_actions Users can view approval actions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view approval actions in their organization" ON public.approval_actions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.approval_requests
  WHERE ((approval_requests.id = approval_actions.approval_request_id) AND public.is_org_member(auth.uid(), approval_requests.organization_id)))));


--
-- Name: approval_requests Users can view approval requests in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view approval requests in their organization" ON public.approval_requests FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: approval_workflow_steps Users can view approval workflow steps in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view approval workflow steps in their organization" ON public.approval_workflow_steps FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.approval_workflows
  WHERE ((approval_workflows.id = approval_workflow_steps.workflow_id) AND public.is_org_member(auth.uid(), approval_workflows.organization_id)))));


--
-- Name: approval_workflows Users can view approval workflows in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view approval workflows in their organization" ON public.approval_workflows FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: fixed_asset_categories Users can view asset categories in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view asset categories in their org" ON public.fixed_asset_categories FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: bank_accounts Users can view bank accounts in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view bank accounts in their organization" ON public.bank_accounts FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: bill_lines Users can view bill lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view bill lines in their organization" ON public.bill_lines FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.bills b
  WHERE ((b.id = bill_lines.bill_id) AND public.is_org_member(b.organization_id, auth.uid())))));


--
-- Name: bills Users can view bills in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view bills in their organization" ON public.bills FOR SELECT USING (public.is_org_member(organization_id, auth.uid()));


--
-- Name: compilation_reports Users can view compilation reports for their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view compilation reports for their organizations" ON public.compilation_reports FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: credit_card_reconciliations Users can view credit card reconciliations in their organizatio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view credit card reconciliations in their organizatio" ON public.credit_card_reconciliations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.credit_cards cc
  WHERE ((cc.id = credit_card_reconciliations.credit_card_id) AND public.is_org_member(auth.uid(), cc.organization_id)))));


--
-- Name: credit_card_transactions Users can view credit card transactions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view credit card transactions in their organization" ON public.credit_card_transactions FOR SELECT USING ((credit_card_id IN ( SELECT cc.id
   FROM public.credit_cards cc
  WHERE (cc.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE (organization_members.user_id = auth.uid()))))));


--
-- Name: credit_cards Users can view credit cards in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view credit cards in their organization" ON public.credit_cards FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: credit_note_lines Users can view credit note lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view credit note lines in their organization" ON public.credit_note_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.credit_notes
  WHERE ((credit_notes.id = credit_note_lines.credit_note_id) AND public.is_org_member(auth.uid(), credit_notes.organization_id)))));


--
-- Name: credit_notes Users can view credit notes in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view credit notes in their organization" ON public.credit_notes FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: currencies Users can view currencies in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view currencies in their organization" ON public.currencies FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: customer_statements Users can view customer statements in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view customer statements in their organization" ON public.customer_statements FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: customers Users can view customers in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view customers in their organization" ON public.customers FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: depreciation_entries Users can view depreciation entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view depreciation entries" ON public.depreciation_entries FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.fixed_assets a
  WHERE ((a.id = depreciation_entries.asset_id) AND public.is_org_member(auth.uid(), a.organization_id)))));


--
-- Name: employee_td1 Users can view employee TD1 in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view employee TD1 in their organization" ON public.employee_td1 FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = employee_td1.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: employees Users can view employees in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view employees in their organization" ON public.employees FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: exchange_rates Users can view exchange rates in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view exchange rates in their organization" ON public.exchange_rates FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: expense_claim_lines Users can view expense claim lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view expense claim lines in their organization" ON public.expense_claim_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.expense_claims
  WHERE ((expense_claims.id = expense_claim_lines.expense_claim_id) AND public.is_org_member(auth.uid(), expense_claims.organization_id)))));


--
-- Name: expense_claims Users can view expense claims in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view expense claims in their organization" ON public.expense_claims FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: fiscal_periods Users can view fiscal periods in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view fiscal periods in their org" ON public.fiscal_periods FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: fixed_assets Users can view fixed assets in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view fixed assets in their org" ON public.fixed_assets FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_adjustments Users can view inventory adjustments in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view inventory adjustments in their org" ON public.inventory_adjustments FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_categories Users can view inventory categories in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view inventory categories in their org" ON public.inventory_categories FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_items Users can view inventory items in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view inventory items in their org" ON public.inventory_items FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: inventory_lots Users can view inventory lots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view inventory lots" ON public.inventory_lots FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.inventory_items i
  WHERE ((i.id = inventory_lots.item_id) AND public.is_org_member(auth.uid(), i.organization_id)))));


--
-- Name: inventory_transactions Users can view inventory transactions in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view inventory transactions in their org" ON public.inventory_transactions FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: invoice_lines Users can view invoice lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view invoice lines in their organization" ON public.invoice_lines FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.invoices inv
  WHERE ((inv.id = invoice_lines.invoice_id) AND public.is_org_member(auth.uid(), inv.organization_id)))));


--
-- Name: invoices Users can view invoices in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view invoices in their organization" ON public.invoices FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: journal_entries Users can view journal entries in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view journal entries in their organization" ON public.journal_entries FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: journal_entry_lines Users can view journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view journal entry lines" ON public.journal_entry_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.journal_entries je
  WHERE ((je.id = journal_entry_lines.journal_entry_id) AND public.is_org_member(auth.uid(), je.organization_id)))));


--
-- Name: lease_categories Users can view lease categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view lease categories" ON public.lease_categories FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: lease_modifications Users can view lease modifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view lease modifications" ON public.lease_modifications FOR SELECT USING ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE public.is_org_member(auth.uid(), leases.organization_id))));


--
-- Name: lease_payment_schedule Users can view lease payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view lease payments" ON public.lease_payment_schedule FOR SELECT USING ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE public.is_org_member(auth.uid(), leases.organization_id))));


--
-- Name: leases Users can view leases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view leases" ON public.leases FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: onboarding_tasks Users can view onboarding tasks in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view onboarding tasks in their organization" ON public.onboarding_tasks FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = onboarding_tasks.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: cost_allocations Users can view own org cost allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own org cost allocations" ON public.cost_allocations FOR SELECT USING ((organization_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.owner_id = auth.uid()))));


--
-- Name: inventory_valuations Users can view own org inventory valuations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own org inventory valuations" ON public.inventory_valuations FOR SELECT USING ((organization_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.owner_id = auth.uid()))));


--
-- Name: pay_runs Users can view pay runs in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view pay runs in their organization" ON public.pay_runs FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: pay_stubs Users can view pay stubs in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view pay stubs in their organization" ON public.pay_stubs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.pay_runs
  WHERE ((pay_runs.id = pay_stubs.pay_run_id) AND public.is_org_member(auth.uid(), pay_runs.organization_id)))));


--
-- Name: payment_terms Users can view payment terms in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view payment terms in their organization" ON public.payment_terms FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: customer_payments Users can view payments in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view payments in their organization" ON public.customer_payments FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: product_price_history Users can view product price history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view product price history" ON public.product_price_history FOR SELECT USING ((product_service_id IN ( SELECT products_services.id
   FROM public.products_services
  WHERE (products_services.organization_id IN ( SELECT organizations.id
           FROM public.organizations
          WHERE (organizations.owner_id = auth.uid()))))));


--
-- Name: products_services Users can view products_services in their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view products_services in their organizations" ON public.products_services FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: purchase_order_lines Users can view purchase order lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view purchase order lines in their organization" ON public.purchase_order_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.purchase_orders
  WHERE ((purchase_orders.id = purchase_order_lines.purchase_order_id) AND public.is_org_member(auth.uid(), purchase_orders.organization_id)))));


--
-- Name: purchase_orders Users can view purchase orders in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view purchase orders in their organization" ON public.purchase_orders FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: quote_lines Users can view quote lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view quote lines in their organization" ON public.quote_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.quotes
  WHERE ((quotes.id = quote_lines.quote_id) AND public.is_org_member(auth.uid(), quotes.organization_id)))));


--
-- Name: quotes Users can view quotes in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view quotes in their organization" ON public.quotes FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: bank_reconciliations Users can view reconciliations in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view reconciliations in their organization" ON public.bank_reconciliations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.bank_accounts ba
  WHERE ((ba.id = bank_reconciliations.bank_account_id) AND public.is_org_member(auth.uid(), ba.organization_id)))));


--
-- Name: recurring_bill_lines Users can view recurring bill lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view recurring bill lines in their organization" ON public.recurring_bill_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.recurring_bills
  WHERE ((recurring_bills.id = recurring_bill_lines.recurring_bill_id) AND public.is_org_member(auth.uid(), recurring_bills.organization_id)))));


--
-- Name: recurring_bills Users can view recurring bills in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view recurring bills in their organization" ON public.recurring_bills FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: recurring_invoice_lines Users can view recurring invoice lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view recurring invoice lines in their organization" ON public.recurring_invoice_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.recurring_invoices
  WHERE ((recurring_invoices.id = recurring_invoice_lines.recurring_invoice_id) AND public.is_org_member(auth.uid(), recurring_invoices.organization_id)))));


--
-- Name: recurring_invoices Users can view recurring invoices in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view recurring invoices in their organization" ON public.recurring_invoices FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: remittances Users can view remittances in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view remittances in their organization" ON public.remittances FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: transaction_rules Users can view rules in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view rules in their organization" ON public.transaction_rules FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tax_slips Users can view tax slips in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tax slips in their organization" ON public.tax_slips FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = tax_slips.employee_id) AND public.is_org_member(auth.uid(), employees.organization_id)))));


--
-- Name: sales_tax_settings Users can view their org sales tax settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their org sales tax settings" ON public.sales_tax_settings FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tax_codes Users can view their org tax codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their org tax codes" ON public.tax_codes FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: tax_returns Users can view their org tax returns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their org tax returns" ON public.tax_returns FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: user_preferences Users can view their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own preferences" ON public.user_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: bank_transactions Users can view transactions in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view transactions in their organization" ON public.bank_transactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.bank_accounts ba
  WHERE ((ba.id = bank_transactions.bank_account_id) AND public.is_org_member(auth.uid(), ba.organization_id)))));


--
-- Name: vendor_credit_lines Users can view vendor credit lines in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view vendor credit lines in their organization" ON public.vendor_credit_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.vendor_credits
  WHERE ((vendor_credits.id = vendor_credit_lines.vendor_credit_id) AND public.is_org_member(auth.uid(), vendor_credits.organization_id)))));


--
-- Name: vendor_credits Users can view vendor credits in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view vendor credits in their organization" ON public.vendor_credits FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: vendor_payments Users can view vendor payments in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view vendor payments in their organization" ON public.vendor_payments FOR SELECT USING (public.is_org_member(organization_id, auth.uid()));


--
-- Name: vendors Users can view vendors in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view vendors in their organization" ON public.vendors FOR SELECT USING (public.is_org_member(organization_id, auth.uid()));


--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_workflow_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_workflow_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_workflows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_reconciliations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: bill_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bill_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: bills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

--
-- Name: compilation_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compilation_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cost_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_card_reconciliations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_card_reconciliations ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_card_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_card_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_note_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_note_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: currencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_statements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_statements ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: depreciation_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.depreciation_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_td1; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_td1 ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: exchange_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_claim_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expense_claim_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: fixed_asset_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fixed_asset_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: fixed_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_adjustment_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_adjustment_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_lots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_valuations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_valuations ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_entry_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: lease_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lease_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: lease_modifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lease_modifications ENABLE ROW LEVEL SECURITY;

--
-- Name: lease_payment_schedule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lease_payment_schedule ENABLE ROW LEVEL SECURITY;

--
-- Name: leases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: pay_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pay_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: pay_stubs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pay_stubs ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_terms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;

--
-- Name: pricing_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: product_price_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

--
-- Name: products_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products_services ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: quote_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_bill_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recurring_bill_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_bills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_invoice_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recurring_invoice_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: remittances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.remittances ENABLE ROW LEVEL SECURITY;

--
-- Name: roe_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roe_records ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_tax_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_tax_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_returns ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_slips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_slips ENABLE ROW LEVEL SECURITY;

--
-- Name: transaction_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transaction_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_credit_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendor_credit_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_credits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendor_credits ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;