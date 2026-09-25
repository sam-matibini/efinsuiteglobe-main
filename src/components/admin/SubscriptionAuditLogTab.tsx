import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { Loader2, Search } from 'lucide-react';

const ACTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'subscription.extend_trial', label: 'Trial extended' },
  { value: 'subscription.override', label: 'Subscription overridden' },
  { value: 'subscription.set_discount', label: 'Discount set / removed' },
  { value: 'platform_settings.update:subscription.trial_period_days', label: 'Default trial changed' },
  { value: 'platform_settings.update:subscription.global_discount', label: 'Global discount changed' },
  { value: 'discount_preset.create', label: 'Preset created' },
  { value: 'discount_preset.archive', label: 'Preset archived' },
];

const PAGE_SIZE = 25;

interface AuditRow {
  id: string;
  created_at: string;
  user_id: string | null;
  organization_id: string | null;
  action: string;
  entity_type: string | null;
  old_values: any;
  new_values: any;
}

function actionBadge(action: string) {
  if (action.startsWith('subscription.')) return <Badge variant="secondary">{action.replace('subscription.', '')}</Badge>;
  if (action.startsWith('platform_settings.')) return <Badge variant="outline">platform default</Badge>;
  if (action.startsWith('discount_preset.')) return <Badge variant="outline">{action.replace('discount_preset.', 'preset ')}</Badge>;
  return <Badge>{action}</Badge>;
}

function renderDetails(row: AuditRow): string {
  const nv = row.new_values || {};
  const ov = row.old_values || {};
  switch (row.action) {
    case 'subscription.extend_trial': {
      const days = nv.extended_by_days ?? nv.days ?? '?';
      return `Extended trial by ${days} day(s)${nv.new_trial_end ? ` → ${format(new Date(nv.new_trial_end), 'PP')}` : ''}`;
    }
    case 'subscription.override': {
      const parts: string[] = [];
      if (nv.status && nv.status !== ov.status) parts.push(`status: ${ov.status || '—'} → ${nv.status}`);
      if (nv.plan_id && nv.plan_id !== ov.plan_id) parts.push(`plan changed`);
      if (nv.current_period_end) parts.push(`period end → ${format(new Date(nv.current_period_end), 'PP')}`);
      return parts.join(' · ') || 'Subscription overridden';
    }
    case 'subscription.set_discount': {
      if (Number(nv.discount_percent) > 0) {
        return `${nv.discount_percent}% off${nv.stripe_coupon_id ? ` · coupon ${nv.stripe_coupon_id}` : ''}${nv.discount_expires_at ? ` · until ${format(new Date(nv.discount_expires_at), 'PP')}` : ''}`;
      }
      return `Removed discount${ov.stripe_coupon_id ? ` (was ${ov.stripe_coupon_id})` : ''}`;
    }
    case 'platform_settings.update:subscription.trial_period_days': {
      return `Trial default: ${ov?.days ?? '—'} → ${nv?.days ?? '—'} days`;
    }
    case 'platform_settings.update:subscription.global_discount': {
      const pct = Number(nv?.percent) || 0;
      if (pct > 0) return `Global discount: ${pct}%${nv.stripe_coupon_id ? ` · ${nv.stripe_coupon_id}` : ''}`;
      return 'Global discount removed';
    }
    case 'discount_preset.create':
      return `Created preset ${nv?.name || nv?.code || ''}`.trim();
    case 'discount_preset.archive':
      return `Archived preset ${ov?.name || ov?.code || ''}`.trim();
    default:
      return '';
  }
}

export function SubscriptionAuditLogTab() {
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [orgSearch, setOrgSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscription-audit', actionFilter, page],
    queryFn: async () => {
      let q = supabase
        .from('audit_logs')
        .select('id, created_at, user_id, organization_id, action, entity_type, old_values, new_values', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (actionFilter === 'all') {
        q = q.or('action.like.subscription.%,action.like.platform_settings.update:subscription.%,action.like.discount_preset.%');
      } else {
        q = q.eq('action', actionFilter);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data || []) as AuditRow[], count: count || 0 };
    },
  });

  const rows = data?.rows || [];
  const total = data?.count || 0;

  // Batch-lookup emails & org names
  const userIds = useMemo(() => Array.from(new Set(rows.map(r => r.user_id).filter(Boolean) as string[])), [rows]);
  const orgIds = useMemo(() => Array.from(new Set(rows.map(r => r.organization_id).filter(Boolean) as string[])), [rows]);

  const { data: profiles } = useQuery({
    queryKey: ['audit-profiles', userIds],
    queryFn: async () => {
      if (!userIds.length) return {} as Record<string, string>;
      const { data } = await supabase.from('profiles').select('id, email').in('id', userIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.email; });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const { data: orgs } = useQuery({
    queryKey: ['audit-orgs', orgIds],
    queryFn: async () => {
      if (!orgIds.length) return {} as Record<string, string>;
      const { data } = await supabase.from('organizations').select('id, name').in('id', orgIds);
      const map: Record<string, string> = {};
      (data || []).forEach((o: any) => { map[o.id] = o.name; });
      return map;
    },
    enabled: orgIds.length > 0,
  });

  const filteredRows = useMemo(() => {
    if (!orgSearch.trim()) return rows;
    const needle = orgSearch.trim().toLowerCase();
    return rows.filter(r => (orgs?.[r.organization_id || ''] || '').toLowerCase().includes(needle));
  }, [rows, orgs, orgSearch]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Audit Log</CardTitle>
        <CardDescription>
          Trial extensions, overrides, discounts, and platform-level defaults changed by admins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map(a => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by organization name (current page)…"
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">When</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No audit entries found.
                  </TableCell>
                </TableRow>
              )}
              {filteredRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(r.created_at), 'PP p')}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.user_id ? (profiles?.[r.user_id] || r.user_id.slice(0, 8)) : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.organization_id ? (orgs?.[r.organization_id] || r.organization_id.slice(0, 8)) : <span className="text-muted-foreground italic">global</span>}
                  </TableCell>
                  <TableCell>{actionBadge(r.action)}</TableCell>
                  <TableCell className="text-sm">{renderDetails(r)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            {total > 0 ? `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}` : ''}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
