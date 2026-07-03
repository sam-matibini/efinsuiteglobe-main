import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AuditRow {
  id: string;
  from_currency: string;
  to_currency: string;
  effective_date: string;
  old_rate: number | null;
  new_rate: number;
  action: string;
  source: string | null;
  performed_at: string;
}

export function RateAuditPanel() {
  const { organization } = useCurrentOrganization();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['exchange_rate_audit', organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_rate_audit')
        .select('*')
        .eq('organization_id', organization!.id)
        .order('performed_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AuditRow[];
    },
    enabled: !!organization?.id,
  });

  return (
    <Card className="p-4">
      <h3 className="text-base font-semibold mb-3">Rate Change Audit Log</h3>
      <ScrollArea className="h-72">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">No rate changes logged yet.</p>}
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-start justify-between text-sm border-b pb-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant={r.action === 'insert' ? 'default' : r.action === 'update' ? 'secondary' : 'destructive'}>
                    {r.action}
                  </Badge>
                  <span className="font-mono">{r.from_currency} → {r.to_currency}</span>
                  <span className="text-muted-foreground">@ {r.effective_date}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.old_rate != null && <>was {Number(r.old_rate).toFixed(6)} → </>}
                  <span className="font-medium text-foreground">{Number(r.new_rate).toFixed(6)}</span>
                  {r.source && <span className="ml-2">({r.source})</span>}
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(r.performed_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
