
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS prepared_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS posted_at timestamp with time zone;

UPDATE public.bills
   SET approval_status = 'approved',
       posted_at = COALESCE(posted_at, created_at)
 WHERE journal_entry_id IS NOT NULL
   AND approval_status = 'pending_approval';

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS posted_at timestamp with time zone;

UPDATE public.expenses
   SET approval_status = 'approved',
       posted_at = COALESCE(posted_at, created_at)
 WHERE is_posted = true
   AND approval_status = 'pending_approval';

ALTER TABLE public.expense_claims
  ADD COLUMN IF NOT EXISTS prepared_by uuid,
  ADD COLUMN IF NOT EXISTS posted_at timestamp with time zone;

UPDATE public.expense_claims
   SET posted_at = COALESCE(posted_at, created_at)
 WHERE journal_entry_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.document_approvers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  document_type text NOT NULL DEFAULT 'all',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, document_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_approvers TO authenticated;
GRANT ALL ON public.document_approvers TO service_role;

ALTER TABLE public.document_approvers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view document approvers"
  ON public.document_approvers FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can manage document approvers"
  ON public.document_approvers FOR ALL TO authenticated
  USING (public.is_org_admin_or_owner(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin_or_owner(organization_id, auth.uid()));

CREATE TRIGGER update_document_approvers_updated_at
  BEFORE UPDATE ON public.document_approvers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
