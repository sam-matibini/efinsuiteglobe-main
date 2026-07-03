-- Phase 9: Firm/Partner Portal schema

CREATE TABLE public.firm_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.firm_workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.firm_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE public.firm_client_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.firm_workspaces(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid,
  UNIQUE(workspace_id, organization_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.firm_workspaces TO authenticated;
GRANT ALL ON public.firm_workspaces TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firm_workspace_members TO authenticated;
GRANT ALL ON public.firm_workspace_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firm_client_links TO authenticated;
GRANT ALL ON public.firm_client_links TO service_role;

ALTER TABLE public.firm_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_client_links ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_firm_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.firm_workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.firm_workspaces
    WHERE id = _workspace_id AND owner_user_id = _user_id
  );
$$;

CREATE POLICY "firm owner sees workspace" ON public.firm_workspaces
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR public.is_firm_member(id, auth.uid()));
CREATE POLICY "firm owner manages workspace" ON public.firm_workspaces
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "firm members read members" ON public.firm_workspace_members
  FOR SELECT TO authenticated USING (public.is_firm_member(workspace_id, auth.uid()));
CREATE POLICY "firm owner manages members" ON public.firm_workspace_members
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.firm_workspaces w WHERE w.id = workspace_id AND w.owner_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.firm_workspaces w WHERE w.id = workspace_id AND w.owner_user_id = auth.uid())
  );

CREATE POLICY "firm members read client links" ON public.firm_client_links
  FOR SELECT TO authenticated USING (public.is_firm_member(workspace_id, auth.uid()));
CREATE POLICY "firm owner manages client links" ON public.firm_client_links
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.firm_workspaces w WHERE w.id = workspace_id AND w.owner_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.firm_workspaces w WHERE w.id = workspace_id AND w.owner_user_id = auth.uid())
  );

CREATE INDEX idx_firm_members_user ON public.firm_workspace_members(user_id);
CREATE INDEX idx_firm_links_workspace ON public.firm_client_links(workspace_id);