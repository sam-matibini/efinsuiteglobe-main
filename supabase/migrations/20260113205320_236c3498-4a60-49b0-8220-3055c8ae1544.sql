-- Create trigger on auth.users to auto-create profile and assign default role on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update handle_new_user function to use SECURITY DEFINER so it can bypass RLS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;