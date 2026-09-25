
-- 1) Rebuild reporting view to apply division access filter
CREATE OR REPLACE VIEW public.v_je_lines_with_division
WITH (security_invoker = true) AS
SELECT
  jel.*,
  COALESCE(jel.department_id, je.department_id) AS effective_department_id,
  je.entry_date,
  je.status AS je_status,
  je.organization_id AS je_organization_id
FROM public.journal_entry_lines jel
JOIN public.journal_entries je ON je.id = jel.journal_entry_id
WHERE public.user_can_access_division(
  auth.uid(),
  COALESCE(jel.department_id, je.department_id)
);

GRANT SELECT ON public.v_je_lines_with_division TO authenticated;
GRANT SELECT ON public.v_je_lines_with_division TO service_role;

-- 2) Restrict SELECT policies on each division-tagged source table.
--    Pattern: drop the existing org-membership SELECT policy and recreate it
--    AND'd with public.user_can_access_division(auth.uid(), department_id).
--    NULL department_id is treated as accessible (consolidated/legacy rows).

-- invoices
DROP POLICY IF EXISTS "Users can view invoices in their organization" ON public.invoices;
CREATE POLICY "Users can view invoices in their organization"
  ON public.invoices FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- bills
DROP POLICY IF EXISTS "Users can view bills in their organization" ON public.bills;
CREATE POLICY "Users can view bills in their organization"
  ON public.bills FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- expenses
DROP POLICY IF EXISTS "Users can view expenses in their organization" ON public.expenses;
CREATE POLICY "Users can view expenses in their organization"
  ON public.expenses FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_members.organization_id
      FROM organization_members
      WHERE organization_members.user_id = auth.uid()
    )
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- expense_claims
DROP POLICY IF EXISTS "Users can view expense claims in their organization" ON public.expense_claims;
CREATE POLICY "Users can view expense claims in their organization"
  ON public.expense_claims FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- customer_payments
DROP POLICY IF EXISTS "Users can view payments in their organization" ON public.customer_payments;
CREATE POLICY "Users can view payments in their organization"
  ON public.customer_payments FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- vendor_payments
DROP POLICY IF EXISTS "Users can view vendor payments in their organization" ON public.vendor_payments;
CREATE POLICY "Users can view vendor payments in their organization"
  ON public.vendor_payments FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- journal_entries (header-level division)
DROP POLICY IF EXISTS "Users can view journal entries in their organization" ON public.journal_entries;
CREATE POLICY "Users can view journal entries in their organization"
  ON public.journal_entries FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- journal_entry_lines (line OR header division)
DROP POLICY IF EXISTS "Users can view journal entry lines" ON public.journal_entry_lines;
CREATE POLICY "Users can view journal entry lines"
  ON public.journal_entry_lines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_entry_lines.journal_entry_id
        AND public.is_org_member(auth.uid(), je.organization_id)
        AND public.user_can_access_division(
          auth.uid(),
          COALESCE(journal_entry_lines.department_id, je.department_id)
        )
    )
  );

-- bank_transactions
DROP POLICY IF EXISTS "Users can view transactions in their organization" ON public.bank_transactions;
CREATE POLICY "Users can view transactions in their organization"
  ON public.bank_transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bank_accounts ba
      WHERE ba.id = bank_transactions.bank_account_id
        AND public.is_org_member(auth.uid(), ba.organization_id)
    )
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- credit_card_transactions
DROP POLICY IF EXISTS "Users can view credit card transactions in their organization" ON public.credit_card_transactions;
CREATE POLICY "Users can view credit card transactions in their organization"
  ON public.credit_card_transactions FOR SELECT TO authenticated
  USING (
    credit_card_id IN (
      SELECT cc.id FROM public.credit_cards cc
      WHERE cc.organization_id IN (
        SELECT organization_members.organization_id
        FROM public.organization_members
        WHERE organization_members.user_id = auth.uid()
      )
    )
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- purchase_orders
DROP POLICY IF EXISTS "Users can view purchase orders in their organization" ON public.purchase_orders;
CREATE POLICY "Users can view purchase orders in their organization"
  ON public.purchase_orders FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- quotes
DROP POLICY IF EXISTS "Users can view quotes in their organization" ON public.quotes;
CREATE POLICY "Users can view quotes in their organization"
  ON public.quotes FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- credit_notes
DROP POLICY IF EXISTS "Users can view credit notes in their organization" ON public.credit_notes;
CREATE POLICY "Users can view credit notes in their organization"
  ON public.credit_notes FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- vendor_credits
DROP POLICY IF EXISTS "Users can view vendor credits in their organization" ON public.vendor_credits;
CREATE POLICY "Users can view vendor credits in their organization"
  ON public.vendor_credits FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- recurring_invoices
DROP POLICY IF EXISTS "Users can view recurring invoices in their organization" ON public.recurring_invoices;
CREATE POLICY "Users can view recurring invoices in their organization"
  ON public.recurring_invoices FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.user_can_access_division(auth.uid(), department_id)
  );

-- recurring_bills
DROP POLICY IF EXISTS "Users can view recurring bills in their organization" ON public.recurring_bills;
CREATE POLICY "Users can view recurring bills in their organization"
  ON public.recurring_bills FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.user_can_access_division(auth.uid(), department_id)
  );
