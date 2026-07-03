-- Keep invitation status in sync when a membership is created
-- (prevents 'accepted but still pending' situations)

CREATE OR REPLACE FUNCTION public.sync_invitation_on_membership_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  -- Fetch the member's email from profiles
  SELECT p.email INTO v_email
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id
  LIMIT 1;

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.organization_invitations oi
  SET
    status = 'accepted',
    accepted_at = COALESCE(oi.accepted_at, now())
  WHERE oi.organization_id = NEW.organization_id
    AND lower(oi.email) = lower(v_email)
    AND oi.status = 'pending';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invitation_on_membership_insert ON public.organization_members;
CREATE TRIGGER trg_sync_invitation_on_membership_insert
AFTER INSERT ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_invitation_on_membership_insert();

-- Speed up matching invitations by org+email
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_email_status
  ON public.organization_invitations (organization_id, lower(email), status);
