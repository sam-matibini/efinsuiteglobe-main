# Fix: "Failed to upload logo"

## Root cause (verified)

- `OrganizationLogoUpload.tsx` uploads to bucket **`organization-logos`** at path `{organizationId}/logo-*.ext`.
- The bucket exists and is public (SELECT works), but `storage.objects` has **no INSERT / UPDATE / DELETE policies** scoped to it. Every write is therefore blocked by RLS → the SDK throws → the component toasts "Failed to upload logo".
- The existing `public_read_organization_logos` policy targets bucket `documents` (folder `organization-logos`), which does not match this upload path — so it doesn't help writes either.

## Fix

Add org-member-scoped write policies on `storage.objects` for `bucket_id = 'organization-logos'`, keyed off the first path segment being the organization id (matches the code's `${organizationId}/...` layout).

Migration:

```sql
-- Uploads
CREATE POLICY "Org members upload organization logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'organization-logos'
  AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Replace (upsert)
CREATE POLICY "Org members update organization logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'organization-logos'
  AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Remove old logo on change / remove
CREATE POLICY "Org members delete organization logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Public read policy currently points at the wrong bucket; add one for this bucket
CREATE POLICY "Public read organization logos bucket"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'organization-logos'
  AND coalesce((metadata->>'mimetype'), '') LIKE 'image/%'
);
```

No frontend changes required — `OrganizationLogoUpload.tsx` will work once RLS allows the write.

## Verification

1. Reload `/settings?tab=organization`, click **Upload Logo**, pick a PNG/JPG < 2MB.
2. Expect success toast and avatar preview updated; `organizations.logo_url` populated.
3. Change and remove flows should also succeed (covered by UPDATE + DELETE policies).
