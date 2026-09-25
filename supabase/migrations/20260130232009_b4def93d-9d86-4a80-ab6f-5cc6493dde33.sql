-- Create a function to automatically create profiles for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop the trigger if it exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also create a function to get organization member profiles with email for admins
CREATE OR REPLACE FUNCTION public.get_org_member_details(p_organization_id uuid)
RETURNS TABLE (
  member_id uuid,
  user_id uuid,
  role text,
  display_name text,
  joined_at timestamptz,
  created_at timestamptz,
  email text,
  full_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is a member of the organization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = p_organization_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  
  RETURN QUERY
  SELECT 
    om.id as member_id,
    om.user_id,
    om.role,
    om.display_name,
    om.joined_at,
    om.created_at,
    COALESCE(p.email, au.email) as email,
    COALESCE(p.full_name, au.raw_user_meta_data->>'full_name') as full_name,
    p.avatar_url
  FROM public.organization_members om
  LEFT JOIN public.profiles p ON om.user_id = p.user_id
  LEFT JOIN auth.users au ON om.user_id = au.id
  WHERE om.organization_id = p_organization_id
  ORDER BY om.created_at ASC;
END;
$$;