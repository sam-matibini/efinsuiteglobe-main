-- eFinsuite AI Receptionist. ElevenLabs is the voice engine.
-- Customers, invoices, payroll, tax, tickets, and appointments stay in eFinsuite.

CREATE TABLE IF NOT EXISTS public.ai_receptionist_state (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_receptionist_state ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_receptionist_state TO authenticated;

CREATE POLICY "Org managers use the AI receptionist"
  ON public.ai_receptionist_state FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'finance_manager', 'manager')
    )
  );
