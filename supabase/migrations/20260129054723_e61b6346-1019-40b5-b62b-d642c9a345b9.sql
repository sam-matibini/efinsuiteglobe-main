-- Communication Identity table for organization/department/user branding
CREATE TABLE public.communication_identity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    department_id UUID NULL,
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Display information
    display_name VARCHAR(150),
    legal_name VARCHAR(150),
    tagline VARCHAR(255),
    
    -- Logo & Images
    logo_url TEXT,
    logo_position VARCHAR(20) DEFAULT 'left' CHECK (logo_position IN ('left', 'center', 'right')),
    profile_image_url TEXT,
    
    -- Signature
    signature_html TEXT,
    signature_image_url TEXT,
    signature_plain_text TEXT,
    
    -- Contact Details
    address_line1 VARCHAR(150),
    address_line2 VARCHAR(150),
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(150),
    website VARCHAR(150),
    
    -- Hierarchy & Status
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Channel-specific configuration
CREATE TABLE public.communication_identity_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_identity_id UUID NOT NULL REFERENCES public.communication_identity(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'pdf', 'esign')),
    enabled BOOLEAN DEFAULT TRUE,
    custom_signature_html TEXT,
    custom_signature_plain TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(communication_identity_id, channel)
);

-- Indexes for performance
CREATE INDEX idx_comm_identity_org ON public.communication_identity(organization_id);
CREATE INDEX idx_comm_identity_user ON public.communication_identity(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_comm_identity_dept ON public.communication_identity(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_comm_identity_default ON public.communication_identity(organization_id, is_default) WHERE is_default = TRUE;
CREATE INDEX idx_comm_identity_channels_identity ON public.communication_identity_channels(communication_identity_id);

-- Enable RLS
ALTER TABLE public.communication_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_identity_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for communication_identity
CREATE POLICY "Users can view their org communication identity"
ON public.communication_identity FOR SELECT
USING (
    organization_id IN (
        SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage communication identity"
ON public.communication_identity FOR ALL
USING (
    public.is_org_admin_or_owner(organization_id, auth.uid())
    OR user_id = auth.uid()
);

CREATE POLICY "Users can insert their own identity"
ON public.communication_identity FOR INSERT
WITH CHECK (
    public.is_org_admin_or_owner(organization_id, auth.uid())
    OR (user_id = auth.uid() AND organization_id IN (
        SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    ))
);

-- RLS Policies for communication_identity_channels
CREATE POLICY "Users can view channel config for their org"
ON public.communication_identity_channels FOR SELECT
USING (
    communication_identity_id IN (
        SELECT ci.id FROM public.communication_identity ci
        WHERE ci.organization_id IN (
            SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
        )
    )
);

CREATE POLICY "Admins can manage channel config"
ON public.communication_identity_channels FOR ALL
USING (
    communication_identity_id IN (
        SELECT ci.id FROM public.communication_identity ci
        WHERE public.is_org_admin_or_owner(ci.organization_id, auth.uid())
            OR ci.user_id = auth.uid()
    )
);

-- Function to resolve identity with hierarchy (User → Department → Organization)
CREATE OR REPLACE FUNCTION public.resolve_communication_identity(
    p_organization_id UUID,
    p_department_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS public.communication_identity
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_identity public.communication_identity;
BEGIN
    -- Try user-level first
    IF p_user_id IS NOT NULL THEN
        SELECT * INTO v_identity
        FROM public.communication_identity
        WHERE organization_id = p_organization_id
          AND user_id = p_user_id
          AND is_active = TRUE
        ORDER BY priority DESC
        LIMIT 1;
        
        IF FOUND THEN
            RETURN v_identity;
        END IF;
    END IF;
    
    -- Try department-level
    IF p_department_id IS NOT NULL THEN
        SELECT * INTO v_identity
        FROM public.communication_identity
        WHERE organization_id = p_organization_id
          AND department_id = p_department_id
          AND user_id IS NULL
          AND is_active = TRUE
        ORDER BY priority DESC
        LIMIT 1;
        
        IF FOUND THEN
            RETURN v_identity;
        END IF;
    END IF;
    
    -- Fall back to organization default
    SELECT * INTO v_identity
    FROM public.communication_identity
    WHERE organization_id = p_organization_id
      AND department_id IS NULL
      AND user_id IS NULL
      AND is_active = TRUE
    ORDER BY is_default DESC, priority DESC
    LIMIT 1;
    
    RETURN v_identity;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_communication_identity_updated_at
    BEFORE UPDATE ON public.communication_identity
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pm_updated_at();

CREATE TRIGGER update_communication_identity_channels_updated_at
    BEFORE UPDATE ON public.communication_identity_channels
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pm_updated_at();