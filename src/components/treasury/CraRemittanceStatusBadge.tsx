import { Badge } from '@/components/ui/badge';

// Canonical lifecycle (Phase 1 onward). Legacy values from earlier schema are
// mapped to the closest equivalent for display purposes.
export type RemittanceLifecycleStatus =
  | 'draft'
  | 'pending'
  | 'authorized'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'returned'
  | 'cancelled';

const LEGACY_MAP: Record<string, RemittanceLifecycleStatus> = {
  scheduled: 'pending',
  submitted: 'processing',
  paid: 'completed',
  reversed: 'returned',
};

const STYLES: Record<RemittanceLifecycleStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  draft:      { label: 'Draft',      variant: 'outline' },
  pending:    { label: 'Pending',    variant: 'secondary' },
  authorized: { label: 'Authorized', variant: 'secondary', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  processing: { label: 'Processing', variant: 'secondary', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  completed:  { label: 'Completed',  variant: 'default',   className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  failed:     { label: 'Failed',     variant: 'destructive' },
  returned:   { label: 'Returned',   variant: 'destructive', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30' },
  cancelled:  { label: 'Cancelled',  variant: 'outline' },
};

export function normalizeLifecycleStatus(status: string): RemittanceLifecycleStatus {
  if (status in STYLES) return status as RemittanceLifecycleStatus;
  return LEGACY_MAP[status] ?? 'draft';
}

export function CraRemittanceStatusBadge({ status }: { status: string }) {
  const s = normalizeLifecycleStatus(status);
  const cfg = STYLES[s];
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
