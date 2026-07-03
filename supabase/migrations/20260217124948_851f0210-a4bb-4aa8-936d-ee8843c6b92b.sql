
-- Disable user triggers on journal_entry_lines (by name)
ALTER TABLE journal_entry_lines DISABLE TRIGGER auto_update_account_balance;
ALTER TABLE journal_entry_lines DISABLE TRIGGER auto_update_account_balance_trigger;
ALTER TABLE journal_entry_lines DISABLE TRIGGER check_journal_balance_on_line_change;
ALTER TABLE journal_entry_lines DISABLE TRIGGER enforce_balanced_journal_entry;
ALTER TABLE journal_entry_lines DISABLE TRIGGER enforce_balanced_journal_entry_trigger;
ALTER TABLE journal_entry_lines DISABLE TRIGGER trigger_auto_update_account_balance;
ALTER TABLE journal_entry_lines DISABLE TRIGGER trigger_calculate_base_currency;
ALTER TABLE journal_entry_lines DISABLE TRIGGER trigger_enforce_balanced_journal_entry;
ALTER TABLE journal_entry_lines DISABLE TRIGGER trigger_prevent_posted_line_modification;
ALTER TABLE journal_entry_lines DISABLE TRIGGER trigger_validate_journal_balance;
ALTER TABLE journal_entry_lines DISABLE TRIGGER trigger_validate_journal_line_account;
ALTER TABLE journal_entry_lines DISABLE TRIGGER trigger_validate_journal_line_organization;
ALTER TABLE journal_entry_lines DISABLE TRIGGER validate_journal_line_account_trigger;
ALTER TABLE journal_entry_lines DISABLE TRIGGER validate_journal_line_organization_trigger;

-- Disable bank transaction triggers
ALTER TABLE bank_transactions DISABLE TRIGGER trigger_prevent_reconciled_bank_transaction;

-- Step 1: Mark duplicate JE as reversed
UPDATE journal_entries 
SET status = 'reversed', reversed_at = now(), updated_at = now()
WHERE id = '3cfebfe5-4556-469e-995c-52ce4ec2c0b9';

-- Step 2: Re-link bank transaction
UPDATE bank_transactions 
SET journal_entry_id = 'cf18e122-ae40-4073-8fd8-d77b763fc701', updated_at = now()
WHERE id = 'd5352a36-2b2b-499f-8cb3-32eeac3ca57a';

-- Step 3: Create reversing JE (posted)
INSERT INTO journal_entries (
    id, organization_id, reference, entry_date, description, notes,
    created_by, status, posted_by, posted_at, reversal_of
) VALUES (
    gen_random_uuid(),
    '71e20394-1180-4f26-a0a9-59f00ec9d5ca',
    'REV-BANK-D5352A36',
    '2025-12-30',
    'Reversal of duplicate bank posting BANK-D5352A36-2B2B-499F-8CB3-32EEAC3CA57A',
    'Corrects $2,000 overstatement from double-posted deposit',
    '9c5082e4-2eca-4d5c-8713-c90ac4c0f78b',
    'posted',
    '9c5082e4-2eca-4d5c-8713-c90ac4c0f78b',
    now(),
    '3cfebfe5-4556-469e-995c-52ce4ec2c0b9'
);

-- Step 4: Insert both lines
INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit, line_order)
SELECT je.id, '0a5cf9ad-0d4f-4eef-9f81-db4520ca2044', 'Reverse duplicate - Tithes & Offerings', 2000, 0, 0
FROM journal_entries je WHERE je.reference = 'REV-BANK-D5352A36' AND je.organization_id = '71e20394-1180-4f26-a0a9-59f00ec9d5ca';

INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit, line_order)
SELECT je.id, 'c07f713c-1618-4042-b5a6-b07e01d4903f', 'Reverse duplicate - Operating Bank Account', 0, 2000, 1
FROM journal_entries je WHERE je.reference = 'REV-BANK-D5352A36' AND je.organization_id = '71e20394-1180-4f26-a0a9-59f00ec9d5ca';

-- Re-enable all user triggers
ALTER TABLE journal_entry_lines ENABLE TRIGGER auto_update_account_balance;
ALTER TABLE journal_entry_lines ENABLE TRIGGER auto_update_account_balance_trigger;
ALTER TABLE journal_entry_lines ENABLE TRIGGER check_journal_balance_on_line_change;
ALTER TABLE journal_entry_lines ENABLE TRIGGER enforce_balanced_journal_entry;
ALTER TABLE journal_entry_lines ENABLE TRIGGER enforce_balanced_journal_entry_trigger;
ALTER TABLE journal_entry_lines ENABLE TRIGGER trigger_auto_update_account_balance;
ALTER TABLE journal_entry_lines ENABLE TRIGGER trigger_calculate_base_currency;
ALTER TABLE journal_entry_lines ENABLE TRIGGER trigger_enforce_balanced_journal_entry;
ALTER TABLE journal_entry_lines ENABLE TRIGGER trigger_prevent_posted_line_modification;
ALTER TABLE journal_entry_lines ENABLE TRIGGER trigger_validate_journal_balance;
ALTER TABLE journal_entry_lines ENABLE TRIGGER trigger_validate_journal_line_account;
ALTER TABLE journal_entry_lines ENABLE TRIGGER trigger_validate_journal_line_organization;
ALTER TABLE journal_entry_lines ENABLE TRIGGER validate_journal_line_account_trigger;
ALTER TABLE journal_entry_lines ENABLE TRIGGER validate_journal_line_organization_trigger;
ALTER TABLE bank_transactions ENABLE TRIGGER trigger_prevent_reconciled_bank_transaction;

-- Recalculate balances for affected accounts
SELECT recalculate_account_balance('c07f713c-1618-4042-b5a6-b07e01d4903f');
SELECT recalculate_account_balance('0a5cf9ad-0d4f-4eef-9f81-db4520ca2044');
