
-- Create ai_sheets_conversations table
CREATE TABLE public.ai_sheets_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  sheet_name TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_sheets_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: organization members only
CREATE POLICY "Members can view their org AI sheets conversations"
  ON public.ai_sheets_conversations
  FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can insert AI sheets conversations"
  ON public.ai_sheets_conversations
  FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can update AI sheets conversations"
  ON public.ai_sheets_conversations
  FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Members can delete AI sheets conversations"
  ON public.ai_sheets_conversations
  FOR DELETE
  USING (is_org_member(auth.uid(), organization_id));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_ai_sheets_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ai_sheets_conversations_updated_at
  BEFORE UPDATE ON public.ai_sheets_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_sheets_conversations_updated_at();

-- Add ai_sheets_enabled and ai_sheets_preferences to organizations (if columns don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'ai_sheets_enabled'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN ai_sheets_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'ai_sheets_preferences'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN ai_sheets_preferences JSONB NOT NULL DEFAULT '{}';
  END IF;
END;
$$;
