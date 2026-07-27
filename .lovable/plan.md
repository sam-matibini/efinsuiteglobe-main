## Fix

In `supabase/functions/efincash-proxy/index.ts`, the RPC call uses wrong parameter names. The actual function signature is `is_org_admin_or_owner(p_org_id, p_user_id)`, not `_user_id, _org_id`.

Change:
```ts
await admin.rpc('is_org_admin_or_owner', { _user_id: userId, _org_id: input.organization_id })
```
to:
```ts
await admin.rpc('is_org_admin_or_owner', { p_user_id: userId, p_org_id: input.organization_id })
```

Then redeploy the `efincash-proxy` edge function.