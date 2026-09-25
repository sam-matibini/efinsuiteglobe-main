
-- Temporarily disable the trigger that prevents modification of posted entries
ALTER TABLE journal_entry_lines DISABLE TRIGGER trigger_prevent_posted_line_modification;

-- Delete the fiscal year close record
DELETE FROM fiscal_year_closes WHERE fiscal_year = 2024;

-- Delete the old closing journal entry lines
DELETE FROM journal_entry_lines WHERE journal_entry_id = 'b2d7e375-fa35-4475-a127-989913eb916d';

-- Re-enable the trigger
ALTER TABLE journal_entry_lines ENABLE TRIGGER trigger_prevent_posted_line_modification;

-- Delete the old closing journal entry
DELETE FROM journal_entries WHERE id = 'b2d7e375-fa35-4475-a127-989913eb916d';

-- Recalculate all account balances
SELECT public.recalculate_all_account_balances('7b265809-a1af-4490-ab00-953ddab68747');
