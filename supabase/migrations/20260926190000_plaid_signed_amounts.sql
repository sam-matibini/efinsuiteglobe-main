-- Older Plaid imports stored every bank amount as a positive number and
-- swapped the direction. The gateway uses a positive amount for a deposit
-- and a negative amount for a withdrawal. Those legacy rows have a PLAID-
-- reference, a positive amount, and no imported_at. New imports set
-- imported_at, so this update does not run twice.

UPDATE public.bank_transactions
SET
  amount = CASE
    WHEN transaction_type = 'deposit' THEN -amount
    ELSE amount
  END,
  transaction_type = CASE
    WHEN transaction_type = 'deposit' THEN 'withdrawal'
    WHEN transaction_type = 'withdrawal' THEN 'deposit'
    ELSE transaction_type
  END,
  imported_at = now()
WHERE reference LIKE 'PLAID-%'
  AND imported_at IS NULL
  AND amount > 0
  AND transaction_type IN ('deposit', 'withdrawal');
