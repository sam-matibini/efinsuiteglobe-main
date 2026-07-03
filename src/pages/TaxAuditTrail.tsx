import { useState } from 'react';
import { Activity, RefreshCw, User, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useTaxAuditLog } from '@/hooks/useTaxAuditLog';
import { format, parseISO } from 'date-fns';
import { AuditTrailPanel } from '@/components/tax/AuditTrailPanel';

export default function TaxAuditTrail() {
  const { organization } = useCurrentOrganization();
  const [entityType, setEntityType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { data: entries = [], isLoading, refetch, isFetching } = useTaxAuditLog({
    organizationId: organization?.id,
    entityType: entityType === 'all' ? undefined : entityType,
    limit: 500,
  });

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.action.toLowerCase().includes(s) ||
      e.entity_type.toLowerCase().includes(s) ||
      (e.reason ?? '').toLowerCase().includes(s) ||
      (e.actor_name ?? '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tax Audit Trail</h1>
          <p className="text-muted-foreground mt-1">
            All tax-related changes: rate updates, code edits, period locks/unlocks, and return filings.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Action, actor, reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Label>Entity type</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                <SelectItem value="tax_code">Tax code</SelectItem>
                <SelectItem value="tax_filing_period">Filing period</SelectItem>
                <SelectItem value="tax_return">Tax return</SelectItem>
                <SelectItem value="tax_authority">Tax authority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <AuditTrailPanel entries={filtered} isLoading={isLoading} />
    </div>
  );
}
