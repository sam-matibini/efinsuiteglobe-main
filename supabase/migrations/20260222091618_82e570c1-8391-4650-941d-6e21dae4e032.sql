ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_charges numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_label text DEFAULT 'Adjustment';