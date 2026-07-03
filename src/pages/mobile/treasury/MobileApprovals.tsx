import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

export default function MobileApprovals() {
  return (
    <div className="p-4 space-y-3">
      <h2 className="font-semibold text-lg">Approvals</h2>
      <Card><CardContent className="p-4 text-sm text-muted-foreground space-y-3">
        <p>The mobile approval queue is in preview. For now, review pending approvals on the desktop site.</p>
        <Link to="/banking-payments/approval-rules" className="text-primary flex items-center gap-1">
          Open desktop approvals <ExternalLink className="h-3 w-3" />
        </Link>
      </CardContent></Card>
    </div>
  );
}
