UPDATE public.credit_card_transactions
SET transaction_type = 'charge',
    updated_at = now()
WHERE status = 'pending'
  AND journal_entry_id IS NULL
  AND transaction_type = 'payment'
  AND description !~* '(payment|pmt|autopay|auto[- ]pay|pre[- ]auth pmt|thank ?you|paiement|transfer to card|bill payment|online payment|mobile payment|refund|return|reversal|chargeback|credit memo|interest|finance charge|annual fee|service charge|late fee|overlimit)';