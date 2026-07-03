import { Card, CardContent } from '@/components/ui/card';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useTreasuryAlerts } from '@/hooks/useTreasuryAlerts';
import { Bell, CheckSquare, FileCheck2, Wallet } from 'lucide-react';

export default function MobileHome() {
  const { currentOrganization } = useOrganizationContext();
  const { data: alerts = [] } = useTreasuryAlerts(currentOrganization?.id);
  const openAlerts = alerts.filter((a) => !a.ack_at).length;
  const critical = alerts.filter((a) => a.severity === 'critical' && !a.ack_at).length;

  const tiles = [
    { label: 'Open alerts', value: openAlerts, sub: `${critical} critical`, icon: Bell },
    { label: 'Pending approvals', value: '—', sub: 'tap to review', icon: CheckSquare },
    { label: 'Next filing', value: '—', sub: 'see filings', icon: FileCheck2 },
    { label: 'Cash position', value: '—', sub: 'as of today', icon: Wallet },
  ];

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-muted-foreground">{currentOrganization?.name ?? 'Select an organization'}</p>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.label}><CardContent className="p-4 space-y-1">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold">{t.value}</div>
              <div className="text-xs font-medium">{t.label}</div>
              <div className="text-[10px] text-muted-foreground">{t.sub}</div>
            </CardContent></Card>
          );
        })}
      </div>
    </div>
  );
}
