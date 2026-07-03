-- =====================================================
-- SCHEMA-LEVEL DOUBLE-ENTRY ENFORCEMENT (ALL JURISDICTIONS)
-- GAAP/IFRS/ASPE Compliant - Works for all countries
-- =====================================================

-- 1. Attach validate_journal_line_account trigger if not exists
DROP TRIGGER IF EXISTS validate_journal_line_account_trigger ON public.journal_entry_lines;
CREATE TRIGGER validate_journal_line_account_trigger
  BEFORE INSERT OR UPDATE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_journal_line_account();

-- 2. Attach organization opening balance validation trigger if not exists
DROP TRIGGER IF EXISTS validate_org_opening_balance_trigger ON public.accounts;
CREATE TRIGGER validate_org_opening_balance_trigger
  AFTER INSERT OR UPDATE OF opening_balance ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_organization_opening_balance();

-- 3. Attach enforce_balanced_journal_entry trigger if not exists
DROP TRIGGER IF EXISTS enforce_balanced_journal_entry_trigger ON public.journal_entry_lines;
CREATE TRIGGER enforce_balanced_journal_entry_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_balanced_journal_entry();

-- 4. Attach auto_update_account_balance trigger if not exists
DROP TRIGGER IF EXISTS auto_update_account_balance_trigger ON public.journal_entry_lines;
CREATE TRIGGER auto_update_account_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_account_balance();

-- 5. Attach on_journal_entry_posted trigger if not exists
DROP TRIGGER IF EXISTS on_journal_entry_posted_trigger ON public.journal_entries;
CREATE TRIGGER on_journal_entry_posted_trigger
  AFTER UPDATE OF status ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.on_journal_entry_posted();

-- 6. Attach prevent_posted_entry_modification trigger if not exists
DROP TRIGGER IF EXISTS trigger_prevent_posted_line_modification ON public.journal_entry_lines;
CREATE TRIGGER trigger_prevent_posted_line_modification
  BEFORE UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_posted_entry_modification();

-- 7. Attach verify_balanced_after_post trigger if not exists
DROP TRIGGER IF EXISTS verify_balanced_after_post_trigger ON public.journal_entries;
CREATE TRIGGER verify_balanced_after_post_trigger
  AFTER UPDATE OF status ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_balanced_after_post();

-- 8. Attach journal entry completeness validation trigger if not exists
DROP TRIGGER IF EXISTS validate_journal_entry_completeness_trigger ON public.journal_entries;
CREATE TRIGGER validate_journal_entry_completeness_trigger
  BEFORE UPDATE OF status ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_journal_entry_completeness();

-- 9. Attach journal line organization validation trigger if not exists
DROP TRIGGER IF EXISTS validate_journal_line_organization_trigger ON public.journal_entry_lines;
CREATE TRIGGER validate_journal_line_organization_trigger
  BEFORE INSERT OR UPDATE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_journal_line_organization();

-- 10. Add comment to document the integrity system
COMMENT ON TABLE public.journal_entries IS 'Journal entries with schema-level double-entry enforcement. Triggers ensure GAAP/IFRS/ASPE compliance across all countries/jurisdictions.';
COMMENT ON TABLE public.journal_entry_lines IS 'Journal entry lines with automatic balance enforcement, account validation, and audit trail protection.';
COMMENT ON TABLE public.accounts IS 'Chart of accounts with opening balance validation ensuring debits = credits per organization.';