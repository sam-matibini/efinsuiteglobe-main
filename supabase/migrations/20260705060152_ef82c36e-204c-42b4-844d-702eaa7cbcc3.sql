-- 1) Fix lease payment JEs (linked directly via lease_payment_schedule.journal_entry_id)
UPDATE public.journal_entries je
SET entry_date = ls.payment_date,
    updated_at = now()
FROM public.lease_payment_schedule ls
WHERE ls.journal_entry_id = je.id
  AND je.entry_date <> ls.payment_date;

-- 2) Fix lease depreciation JEs (linked via journal_entry_lines.source_document_*)
UPDATE public.journal_entries je
SET entry_date = ls.payment_date,
    updated_at = now()
FROM public.journal_entry_lines jel
JOIN public.lease_payment_schedule ls
  ON ls.id = jel.source_document_id
WHERE jel.journal_entry_id = je.id
  AND jel.source_document_type = 'lease_depreciation'
  AND je.entry_date <> ls.payment_date;

-- 3) Align schedule's actual_payment_date with the scheduled payment_date
UPDATE public.lease_payment_schedule
SET actual_payment_date = payment_date
WHERE status = 'paid'
  AND actual_payment_date IS DISTINCT FROM payment_date;