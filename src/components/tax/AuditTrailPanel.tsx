import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Activity, User, Clock, FileText, Lock, Unlock, Edit3, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { TaxAuditEntry } from '@/hooks/useTaxAuditLog';

const ACTION_ICON: Record<string, typeof Activity> = {
  rate_change: Edit3,
  code_created: FileText,
  code_updated: Edit3,
  code_deleted: X,
  period_locked: Lock,
  period_unlocked: Unlock,
  return_filed: Check,
  return_adjusted: Edit3,
};

const ACTION_VARIANT: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  period_locked: 'secondary',
  period_unlocked: 'destructive',
  return_filed: 'default',
  code_deleted: 'destructive',
};

export function AuditTrailPanel({
  entries,
  isLoading,
}: {
  entries: TaxAuditEntry[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <Card className="p-6 space-y-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        <Activity className="h-12 w-12 mx-auto mb-2 opacity-30" />
        <p>No audit events recorded yet.</p>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <ol className="divide-y divide-border">
        {entries.map((e) => {
          const Icon = ACTION_ICON[e.action] ?? Activity;
          const variant = ACTION_VARIANT[e.action] ?? 'outline';
          return (
            <li key={e.id} className="p-4 flex gap-4 hover:bg-muted/50 transition-colors">
              <div className="flex-shrink-0 mt-1">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge variant={variant} className="font-mono text-xs">
                    {e.action.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">on</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {e.entity_type}
                  </Badge>
                </div>
                <div className="text-sm">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <User className="h-3 w-3" />
                    {e.actor_name ?? 'System'}
                  </span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(parseISO(e.created_at), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
                {e.reason && (
                  <div className="mt-2 text-sm bg-muted/40 border border-border rounded p-2">
                    <span className="text-xs font-semibold text-muted-foreground">Reason: </span>
                    {e.reason}
                  </div>
                )}
                {(e.before_value || e.after_value) && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View change details
                    </summary>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {e.before_value && (
                        <pre className="bg-destructive/5 border border-destructive/20 rounded p-2 overflow-auto max-h-40 text-xs">
                          {JSON.stringify(e.before_value, null, 2)}
                        </pre>
                      )}
                      {e.after_value && (
                        <pre className="bg-primary/5 border border-primary/20 rounded p-2 overflow-auto max-h-40 text-xs">
                          {JSON.stringify(e.after_value, null, 2)}
                        </pre>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
