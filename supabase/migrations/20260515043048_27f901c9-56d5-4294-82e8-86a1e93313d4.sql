UPDATE public.journal_entries
SET status = 'posted', posted_at = now()
WHERE id IN (
  '8926e6f4-9baa-45d9-a98f-4cecad3437d5',
  '90a41673-eb52-4060-bcac-1ba6f32daeee'
) AND status = 'draft';