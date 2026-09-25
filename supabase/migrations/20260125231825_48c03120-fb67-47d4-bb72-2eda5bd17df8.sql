-- =====================================================
-- DONATION MANAGEMENT MODULE - CRA & NPO COMPLIANT
-- Phase 1: Core Donation Engine
-- =====================================================

-- Enum for donation types
CREATE TYPE public.donation_type AS ENUM ('cash', 'cheque', 'credit_card', 'e_transfer', 'securities', 'in_kind', 'payroll_deduction', 'wire_transfer');

-- Enum for donation status
CREATE TYPE public.donation_status AS ENUM ('draft', 'confirmed', 'cancelled', 'refunded');

-- Enum for receipt status
CREATE TYPE public.receipt_status AS ENUM ('draft', 'issued', 'cancelled', 'replaced');

-- Enum for fund type
CREATE TYPE public.fund_type AS ENUM ('unrestricted', 'restricted', 'endowment', 'designated');

-- Enum for pledge status
CREATE TYPE public.pledge_status AS ENUM ('pending', 'partially_fulfilled', 'fulfilled', 'cancelled', 'written_off');

-- Enum for donor type
CREATE TYPE public.donor_type AS ENUM ('individual', 'corporation', 'foundation', 'government', 'anonymous');

-- =====================================================
-- DONATION PROGRAMS TABLE
-- =====================================================
CREATE TABLE public.donation_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  budget DECIMAL(15,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  gl_revenue_account_id UUID REFERENCES public.accounts(id),
  gl_expense_account_id UUID REFERENCES public.accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(organization_id, code)
);

-- =====================================================
-- DONATION FUNDS TABLE
-- =====================================================
CREATE TABLE public.donation_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  fund_type public.fund_type NOT NULL DEFAULT 'unrestricted',
  restriction_terms TEXT,
  target_amount DECIMAL(15,2),
  current_balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  gl_account_id UUID REFERENCES public.accounts(id),
  deferred_revenue_account_id UUID REFERENCES public.accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(organization_id, code)
);

-- =====================================================
-- DONATION CAMPAIGNS TABLE
-- =====================================================
CREATE TABLE public.donation_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  goal_amount DECIMAL(15,2),
  raised_amount DECIMAL(15,2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  program_id UUID REFERENCES public.donation_programs(id),
  fund_id UUID REFERENCES public.donation_funds(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(organization_id, code)
);

-- =====================================================
-- DONATIONS TABLE
-- =====================================================
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  donation_number VARCHAR(50) NOT NULL,
  donor_id UUID NOT NULL REFERENCES public.customers(id),
  date_received DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  donation_type public.donation_type NOT NULL DEFAULT 'cash',
  program_id UUID REFERENCES public.donation_programs(id),
  fund_id UUID REFERENCES public.donation_funds(id),
  campaign_id UUID REFERENCES public.donation_campaigns(id),
  pledge_id UUID,
  -- CRA specific fields
  eligible_amount DECIMAL(15,2) NOT NULL,
  advantage_value DECIMAL(15,2) DEFAULT 0,
  advantage_description TEXT,
  -- Receipt tracking
  receipt_issued BOOLEAN DEFAULT false,
  receipt_id UUID,
  -- Integration fields
  bank_transaction_id UUID REFERENCES public.bank_transactions(id),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  -- Status and notes
  status public.donation_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  memo TEXT,
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  UNIQUE(organization_id, donation_number)
);

-- =====================================================
-- DONATION RECEIPTS TABLE (CRA COMPLIANT)
-- =====================================================
CREATE TABLE public.donation_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) NOT NULL,
  donation_id UUID NOT NULL REFERENCES public.donations(id),
  -- Charity Information (CRA Required)
  charity_legal_name VARCHAR(255) NOT NULL,
  charity_bn VARCHAR(15) NOT NULL, -- Business Number
  charity_address TEXT NOT NULL,
  -- Donor Information (CRA Required)
  donor_name VARCHAR(255) NOT NULL,
  donor_address TEXT NOT NULL,
  -- Donation Details (CRA Required)
  date_of_donation DATE NOT NULL,
  date_of_issue DATE NOT NULL,
  location_issued VARCHAR(255),
  -- Amounts (CRA Required)
  amount DECIMAL(15,2) NOT NULL,
  eligible_amount DECIMAL(15,2) NOT NULL,
  advantage_value DECIMAL(15,2) DEFAULT 0,
  advantage_description TEXT,
  -- Receipt Status
  status public.receipt_status NOT NULL DEFAULT 'draft',
  -- Authorized Signatory
  signatory_name VARCHAR(255),
  signatory_position VARCHAR(255),
  -- CRA Disclaimer
  cra_disclaimer TEXT NOT NULL DEFAULT 'This is an official receipt for income tax purposes. Canada Revenue Agency: www.cra-arc.gc.ca/charities',
  -- Replacement tracking
  replaces_receipt_id UUID REFERENCES public.donation_receipts(id),
  replaced_by_receipt_id UUID REFERENCES public.donation_receipts(id),
  -- Document storage
  document_url TEXT,
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ,
  issued_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  is_locked BOOLEAN DEFAULT false,
  UNIQUE(organization_id, receipt_number)
);

-- Add foreign key from donations to receipts
ALTER TABLE public.donations ADD CONSTRAINT donations_receipt_id_fkey 
  FOREIGN KEY (receipt_id) REFERENCES public.donation_receipts(id);

-- =====================================================
-- DONATION PLEDGES TABLE
-- =====================================================
CREATE TABLE public.donation_pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pledge_number VARCHAR(50) NOT NULL,
  donor_id UUID NOT NULL REFERENCES public.customers(id),
  pledge_date DATE NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount > 0),
  fulfilled_amount DECIMAL(15,2) DEFAULT 0,
  remaining_amount DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - fulfilled_amount) STORED,
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  program_id UUID REFERENCES public.donation_programs(id),
  fund_id UUID REFERENCES public.donation_funds(id),
  campaign_id UUID REFERENCES public.donation_campaigns(id),
  -- Payment schedule
  payment_frequency VARCHAR(20), -- monthly, quarterly, annually
  expected_start_date DATE,
  expected_end_date DATE,
  -- Status
  status public.pledge_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(organization_id, pledge_number)
);

-- Add foreign key from donations to pledges
ALTER TABLE public.donations ADD CONSTRAINT donations_pledge_id_fkey 
  FOREIGN KEY (pledge_id) REFERENCES public.donation_pledges(id);

-- =====================================================
-- DONATION IN-KIND TABLE
-- =====================================================
CREATE TABLE public.donation_in_kind (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category VARCHAR(100),
  quantity INTEGER DEFAULT 1,
  fair_market_value DECIMAL(15,2) NOT NULL,
  appraisal_date DATE,
  appraised_by VARCHAR(255),
  appraisal_document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- DONATION DESIGNATIONS TABLE
-- =====================================================
CREATE TABLE public.donation_designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.donation_programs(id),
  fund_id UUID REFERENCES public.donation_funds(id),
  amount DECIMAL(15,2) NOT NULL,
  percentage DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- DONATION AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE public.donation_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- donation, receipt, pledge
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- created, updated, confirmed, cancelled, issued
  field_changed VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  details JSONB,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  performed_by UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT
);

-- =====================================================
-- DONOR PREFERENCES (Extension to Customers)
-- =====================================================
CREATE TABLE public.donor_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE UNIQUE,
  donor_type public.donor_type DEFAULT 'individual',
  receipt_preference VARCHAR(20) DEFAULT 'email', -- email, pdf, mail, none
  is_anonymous BOOLEAN DEFAULT false,
  casl_consent BOOLEAN DEFAULT false,
  casl_consent_date DATE,
  pipeda_consent BOOLEAN DEFAULT false,
  communication_preferences JSONB DEFAULT '{"email": true, "mail": true, "phone": false}',
  recognition_level VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_donations_organization ON public.donations(organization_id);
CREATE INDEX idx_donations_donor ON public.donations(donor_id);
CREATE INDEX idx_donations_date ON public.donations(date_received);
CREATE INDEX idx_donations_status ON public.donations(status);
CREATE INDEX idx_donations_program ON public.donations(program_id);
CREATE INDEX idx_donations_fund ON public.donations(fund_id);
CREATE INDEX idx_donations_campaign ON public.donations(campaign_id);
CREATE INDEX idx_donations_bank_txn ON public.donations(bank_transaction_id);

CREATE INDEX idx_receipts_organization ON public.donation_receipts(organization_id);
CREATE INDEX idx_receipts_donation ON public.donation_receipts(donation_id);
CREATE INDEX idx_receipts_status ON public.donation_receipts(status);
CREATE INDEX idx_receipts_date_issued ON public.donation_receipts(date_of_issue);

CREATE INDEX idx_pledges_organization ON public.donation_pledges(organization_id);
CREATE INDEX idx_pledges_donor ON public.donation_pledges(donor_id);
CREATE INDEX idx_pledges_status ON public.donation_pledges(status);

CREATE INDEX idx_programs_organization ON public.donation_programs(organization_id);
CREATE INDEX idx_funds_organization ON public.donation_funds(organization_id);
CREATE INDEX idx_campaigns_organization ON public.donation_campaigns(organization_id);

CREATE INDEX idx_audit_logs_entity ON public.donation_audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_organization ON public.donation_audit_logs(organization_id);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================
ALTER TABLE public.donation_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_in_kind ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_preferences ENABLE ROW LEVEL SECURITY;

-- Programs policies
CREATE POLICY "Users can view programs in their organization" ON public.donation_programs
  FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can insert programs in their organization" ON public.donation_programs
  FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can update programs in their organization" ON public.donation_programs
  FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can delete programs in their organization" ON public.donation_programs
  FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));

-- Funds policies
CREATE POLICY "Users can view funds in their organization" ON public.donation_funds
  FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can insert funds in their organization" ON public.donation_funds
  FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can update funds in their organization" ON public.donation_funds
  FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can delete funds in their organization" ON public.donation_funds
  FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));

-- Campaigns policies
CREATE POLICY "Users can view campaigns in their organization" ON public.donation_campaigns
  FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can insert campaigns in their organization" ON public.donation_campaigns
  FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can update campaigns in their organization" ON public.donation_campaigns
  FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can delete campaigns in their organization" ON public.donation_campaigns
  FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));

-- Donations policies
CREATE POLICY "Users can view donations in their organization" ON public.donations
  FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can insert donations in their organization" ON public.donations
  FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can update donations in their organization" ON public.donations
  FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can delete donations in their organization" ON public.donations
  FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));

-- Receipts policies
CREATE POLICY "Users can view receipts in their organization" ON public.donation_receipts
  FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can insert receipts in their organization" ON public.donation_receipts
  FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can update receipts in their organization" ON public.donation_receipts
  FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id) AND is_locked = false);
CREATE POLICY "Users can delete receipts in their organization" ON public.donation_receipts
  FOR DELETE USING (public.is_org_member(auth.uid(), organization_id) AND is_locked = false);

-- Pledges policies
CREATE POLICY "Users can view pledges in their organization" ON public.donation_pledges
  FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can insert pledges in their organization" ON public.donation_pledges
  FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can update pledges in their organization" ON public.donation_pledges
  FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can delete pledges in their organization" ON public.donation_pledges
  FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));

-- In-kind policies (inherit from donation)
CREATE POLICY "Users can view in-kind donations" ON public.donation_in_kind
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.donations d 
    WHERE d.id = donation_id AND public.is_org_member(auth.uid(), d.organization_id)
  ));
CREATE POLICY "Users can insert in-kind donations" ON public.donation_in_kind
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.donations d 
    WHERE d.id = donation_id AND public.is_org_member(auth.uid(), d.organization_id)
  ));
CREATE POLICY "Users can update in-kind donations" ON public.donation_in_kind
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.donations d 
    WHERE d.id = donation_id AND public.is_org_member(auth.uid(), d.organization_id)
  ));
CREATE POLICY "Users can delete in-kind donations" ON public.donation_in_kind
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.donations d 
    WHERE d.id = donation_id AND public.is_org_member(auth.uid(), d.organization_id)
  ));

-- Designations policies
CREATE POLICY "Users can view designations" ON public.donation_designations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.donations d 
    WHERE d.id = donation_id AND public.is_org_member(auth.uid(), d.organization_id)
  ));
CREATE POLICY "Users can insert designations" ON public.donation_designations
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.donations d 
    WHERE d.id = donation_id AND public.is_org_member(auth.uid(), d.organization_id)
  ));
CREATE POLICY "Users can update designations" ON public.donation_designations
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.donations d 
    WHERE d.id = donation_id AND public.is_org_member(auth.uid(), d.organization_id)
  ));
CREATE POLICY "Users can delete designations" ON public.donation_designations
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.donations d 
    WHERE d.id = donation_id AND public.is_org_member(auth.uid(), d.organization_id)
  ));

-- Audit logs policies
CREATE POLICY "Users can view audit logs in their organization" ON public.donation_audit_logs
  FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Users can insert audit logs in their organization" ON public.donation_audit_logs
  FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- Donor preferences policies
CREATE POLICY "Users can view donor preferences" ON public.donor_preferences
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.customers c 
    WHERE c.id = customer_id AND public.is_org_member(auth.uid(), c.organization_id)
  ));
CREATE POLICY "Users can insert donor preferences" ON public.donor_preferences
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.customers c 
    WHERE c.id = customer_id AND public.is_org_member(auth.uid(), c.organization_id)
  ));
CREATE POLICY "Users can update donor preferences" ON public.donor_preferences
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.customers c 
    WHERE c.id = customer_id AND public.is_org_member(auth.uid(), c.organization_id)
  ));

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_donation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_donation_programs_updated_at BEFORE UPDATE ON public.donation_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_donation_updated_at();
CREATE TRIGGER update_donation_funds_updated_at BEFORE UPDATE ON public.donation_funds
  FOR EACH ROW EXECUTE FUNCTION public.update_donation_updated_at();
CREATE TRIGGER update_donation_campaigns_updated_at BEFORE UPDATE ON public.donation_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_donation_updated_at();
CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.update_donation_updated_at();
CREATE TRIGGER update_donation_receipts_updated_at BEFORE UPDATE ON public.donation_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_donation_updated_at();
CREATE TRIGGER update_donation_pledges_updated_at BEFORE UPDATE ON public.donation_pledges
  FOR EACH ROW EXECUTE FUNCTION public.update_donation_updated_at();
CREATE TRIGGER update_donor_preferences_updated_at BEFORE UPDATE ON public.donor_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_donation_updated_at();

-- =====================================================
-- CRA COMPLIANCE TRIGGERS
-- =====================================================

-- Prevent receipt modification after issuance
CREATE OR REPLACE FUNCTION public.prevent_receipt_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = true THEN
    RAISE EXCEPTION 'Cannot modify a locked receipt. CRA compliance requires receipt integrity.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER prevent_locked_receipt_update BEFORE UPDATE ON public.donation_receipts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_receipt_modification();

-- Lock receipt after issuance
CREATE OR REPLACE FUNCTION public.lock_issued_receipt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'issued' AND (OLD.status IS NULL OR OLD.status != 'issued') THEN
    NEW.is_locked = true;
    NEW.issued_at = now();
    NEW.issued_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER lock_receipt_on_issue BEFORE UPDATE ON public.donation_receipts
  FOR EACH ROW EXECUTE FUNCTION public.lock_issued_receipt();

-- Calculate eligible amount automatically
CREATE OR REPLACE FUNCTION public.calculate_eligible_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.eligible_amount IS NULL OR NEW.eligible_amount = 0 THEN
    NEW.eligible_amount = NEW.amount - COALESCE(NEW.advantage_value, 0);
  END IF;
  IF NEW.eligible_amount < 0 THEN
    RAISE EXCEPTION 'Eligible amount cannot be negative. Advantage value exceeds donation amount.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER calculate_donation_eligible_amount BEFORE INSERT OR UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.calculate_eligible_amount();

-- Update pledge fulfilled amount
CREATE OR REPLACE FUNCTION public.update_pledge_fulfilled()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pledge_id IS NOT NULL AND NEW.status = 'confirmed' THEN
    UPDATE public.donation_pledges
    SET fulfilled_amount = fulfilled_amount + NEW.amount,
        status = CASE 
          WHEN fulfilled_amount + NEW.amount >= total_amount THEN 'fulfilled'::public.pledge_status
          WHEN fulfilled_amount + NEW.amount > 0 THEN 'partially_fulfilled'::public.pledge_status
          ELSE status
        END
    WHERE id = NEW.pledge_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_pledge_on_donation AFTER INSERT OR UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.update_pledge_fulfilled();

-- Update campaign raised amount
CREATE OR REPLACE FUNCTION public.update_campaign_raised()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NOT NULL AND NEW.status = 'confirmed' THEN
    UPDATE public.donation_campaigns
    SET raised_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.donations
      WHERE campaign_id = NEW.campaign_id AND status = 'confirmed'
    )
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_campaign_on_donation AFTER INSERT OR UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.update_campaign_raised();

-- Update fund balance
CREATE OR REPLACE FUNCTION public.update_fund_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fund_id IS NOT NULL AND NEW.status = 'confirmed' THEN
    UPDATE public.donation_funds
    SET current_balance = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.donations
      WHERE fund_id = NEW.fund_id AND status = 'confirmed'
    )
    WHERE id = NEW.fund_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_fund_on_donation AFTER INSERT OR UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.update_fund_balance();