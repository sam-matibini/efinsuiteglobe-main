-- Create expenses table for direct expense recording (like Zoho Books)
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_account_id UUID REFERENCES public.accounts(id),
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  tax_treatment VARCHAR(20) NOT NULL DEFAULT 'exclusive' CHECK (tax_treatment IN ('inclusive', 'exclusive')),
  paid_through_account_id UUID REFERENCES public.accounts(id),
  tax_code_id UUID REFERENCES public.tax_codes(id),
  tax_amount NUMERIC(15,2) DEFAULT 0,
  vendor_id UUID REFERENCES public.vendors(id),
  customer_id UUID REFERENCES public.customers(id),
  reference VARCHAR(100),
  notes TEXT,
  receipt_url TEXT,
  is_billable BOOLEAN DEFAULT false,
  expense_type VARCHAR(20) NOT NULL DEFAULT 'expense' CHECK (expense_type IN ('expense', 'mileage')),
  -- Mileage specific fields
  distance NUMERIC(10,2),
  distance_unit VARCHAR(10) DEFAULT 'km',
  rate_per_unit NUMERIC(10,4),
  vehicle_description VARCHAR(255),
  from_location VARCHAR(255),
  to_location VARCHAR(255),
  -- GL integration
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  is_posted BOOLEAN DEFAULT false,
  -- Audit
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expense line items for itemized expenses
CREATE TABLE public.expense_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  expense_account_id UUID REFERENCES public.accounts(id),
  description TEXT,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(15,2) DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_code_id UUID REFERENCES public.tax_codes(id),
  tax_amount NUMERIC(15,2) DEFAULT 0,
  line_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for expenses
CREATE POLICY "Users can view expenses in their organization" 
ON public.expenses 
FOR SELECT 
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create expenses in their organization" 
ON public.expenses 
FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update expenses in their organization" 
ON public.expenses 
FOR UPDATE 
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete expenses in their organization" 
ON public.expenses 
FOR DELETE 
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

-- Create RLS policies for expense_items
CREATE POLICY "Users can view expense items via expenses" 
ON public.expense_items 
FOR SELECT 
USING (expense_id IN (
  SELECT id FROM public.expenses WHERE organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can create expense items via expenses" 
ON public.expense_items 
FOR INSERT 
WITH CHECK (expense_id IN (
  SELECT id FROM public.expenses WHERE organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can update expense items via expenses" 
ON public.expense_items 
FOR UPDATE 
USING (expense_id IN (
  SELECT id FROM public.expenses WHERE organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can delete expense items via expenses" 
ON public.expense_items 
FOR DELETE 
USING (expense_id IN (
  SELECT id FROM public.expenses WHERE organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
));

-- Create indexes for better performance
CREATE INDEX idx_expenses_organization ON public.expenses(organization_id);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX idx_expenses_vendor ON public.expenses(vendor_id);
CREATE INDEX idx_expense_items_expense ON public.expense_items(expense_id);

-- Create trigger for updated_at
CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();