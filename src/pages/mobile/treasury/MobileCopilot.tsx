import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

export default function MobileCopilot() {
  return (
    <div className="p-4 space-y-3">
      <h2 className="font-semibold text-lg">Treasury Copilot</h2>
      <Card><CardContent className="p-4 text-sm text-muted-foreground space-y-3">
        <p>Full streaming Copilot is best on a larger screen. Tap below to open the full experience.</p>
        <Link to="/banking-payments" className="text-primary flex items-center gap-1">
          Open Copilot <ExternalLink className="h-3 w-3" />
        </Link>
      </CardContent></Card>
    </div>
  );
}
