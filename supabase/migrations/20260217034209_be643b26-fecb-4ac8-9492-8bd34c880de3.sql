
-- Make donation_id nullable for consolidated receipts
ALTER TABLE public.donation_receipts ALTER COLUMN donation_id DROP NOT NULL;

-- Add is_consolidated flag
ALTER TABLE public.donation_receipts ADD COLUMN is_consolidated boolean NOT NULL DEFAULT false;

-- Create junction table for consolidated receipt line items
CREATE TABLE public.donation_receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.donation_receipts(id) ON DELETE CASCADE,
  donation_id UUID NOT NULL REFERENCES public.donations(id),
  date_received DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  eligible_amount DECIMAL(15,2) NOT NULL,
  advantage_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  donation_type VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_receipt_items_receipt_id ON public.donation_receipt_items(receipt_id);
CREATE INDEX idx_receipt_items_donation_id ON public.donation_receipt_items(donation_id);

-- RLS
ALTER TABLE public.donation_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receipt items via org membership"
ON public.donation_receipt_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.donation_receipts dr
    WHERE dr.id = receipt_id
    AND public.is_org_member(auth.uid(), dr.organization_id)
  )
);

CREATE POLICY "Users can insert receipt items via org membership"
ON public.donation_receipt_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.donation_receipts dr
    WHERE dr.id = receipt_id
    AND public.is_org_member(auth.uid(), dr.organization_id)
  )
);

CREATE POLICY "Users can delete receipt items via org membership"
ON public.donation_receipt_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.donation_receipts dr
    WHERE dr.id = receipt_id
    AND public.is_org_member(auth.uid(), dr.organization_id)
  )
);
