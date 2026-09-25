
-- ============================================================================
-- ATTACH DOUBLE-ENTRY INTEGRITY TRIGGERS
-- These trigger functions exist but are not attached to tables
-- ============================================================================

-- 1. Enforce balanced journal entry on line changes
DROP TRIGGER IF EXISTS trigger_enforce_balanced_journal_entry ON public.journal_entry_lines;
CREATE TRIGGER trigger_enforce_balanced_journal_entry
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_balanced_journal_entry();

-- 2. Prevent modification of posted journal entry lines
DROP TRIGGER IF EXISTS trigger_prevent_posted_line_modification ON public.journal_entry_lines;
CREATE TRIGGER trigger_prevent_posted_line_modification
  BEFORE UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_posted_entry_modification();

-- 3. Validate journal line points to valid posting account
DROP TRIGGER IF EXISTS trigger_validate_journal_line_account ON public.journal_entry_lines;
CREATE TRIGGER trigger_validate_journal_line_account
  BEFORE INSERT OR UPDATE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_journal_line_account();

-- 4. Validate journal line organization matches entry organization
DROP TRIGGER IF EXISTS trigger_validate_journal_line_organization ON public.journal_entry_lines;
CREATE TRIGGER trigger_validate_journal_line_organization
  BEFORE INSERT OR UPDATE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_journal_line_organization();

-- 5. Auto-update account balance when lines change
DROP TRIGGER IF EXISTS trigger_auto_update_account_balance ON public.journal_entry_lines;
CREATE TRIGGER trigger_auto_update_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_account_balance();

-- 6. When journal entry status changes to 'posted', recalculate affected accounts
DROP TRIGGER IF EXISTS trigger_on_journal_entry_posted ON public.journal_entries;
CREATE TRIGGER trigger_on_journal_entry_posted
  AFTER UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.on_journal_entry_posted();

-- 7. Validate journal entry completeness before posting
DROP TRIGGER IF EXISTS trigger_validate_journal_entry_completeness ON public.journal_entries;
CREATE TRIGGER trigger_validate_journal_entry_completeness
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_journal_entry_completeness();

-- 8. Validate organization opening balances are balanced
DROP TRIGGER IF EXISTS trigger_validate_organization_opening_balance ON public.accounts;
CREATE TRIGGER trigger_validate_organization_opening_balance
  AFTER INSERT OR UPDATE OF opening_balance ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_organization_opening_balance();

-- 9. Prevent modification of reconciled bank transactions
DROP TRIGGER IF EXISTS trigger_prevent_reconciled_bank_transaction ON public.bank_transactions;
CREATE TRIGGER trigger_prevent_reconciled_bank_transaction
  BEFORE UPDATE OR DELETE ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_reconciled_bank_transaction_modification();

-- 10. Prevent modification of reconciled credit card transactions
DROP TRIGGER IF EXISTS trigger_prevent_reconciled_cc_transaction ON public.credit_card_transactions;
CREATE TRIGGER trigger_prevent_reconciled_cc_transaction
  BEFORE UPDATE OR DELETE ON public.credit_card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_reconciled_cc_transaction_modification();

-- 11. Update timestamps on accounts
DROP TRIGGER IF EXISTS trigger_update_accounts_updated_at ON public.accounts;
CREATE TRIGGER trigger_update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Update timestamps on journal entries
DROP TRIGGER IF EXISTS trigger_update_journal_entries_updated_at ON public.journal_entries;
CREATE TRIGGER trigger_update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 13. Recalculate timesheet totals
DROP TRIGGER IF EXISTS trigger_recalculate_timesheet_totals ON public.timesheet_entries;
CREATE TRIGGER trigger_recalculate_timesheet_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_timesheet_totals();
