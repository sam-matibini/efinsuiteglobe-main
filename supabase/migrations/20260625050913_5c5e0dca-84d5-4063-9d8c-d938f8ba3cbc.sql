
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_urls text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.expense_claim_lines ADD COLUMN IF NOT EXISTS receipt_urls text[] NOT NULL DEFAULT '{}';

UPDATE public.expenses
   SET receipt_urls = ARRAY[receipt_url]
 WHERE receipt_url IS NOT NULL
   AND (receipt_urls IS NULL OR array_length(receipt_urls, 1) IS NULL);

UPDATE public.expense_claim_lines
   SET receipt_urls = ARRAY[receipt_url]
 WHERE receipt_url IS NOT NULL
   AND (receipt_urls IS NULL OR array_length(receipt_urls, 1) IS NULL);
