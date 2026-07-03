import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CopilotPanel } from '@/components/treasury/CopilotPanel';
import { Sparkles } from 'lucide-react';

export default function FirmCopilot() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Firm Copilot</h1>
        <p className="text-muted-foreground mt-1">Cross-client treasury chat. Switch your active organization to scope the Copilot to that client.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Ask the Copilot</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">The Copilot streams answers and traces each tool call. Use it to triage alerts, due remittances, and anomalies across your firm.</p>
          <CopilotPanel />
        </CardContent>
      </Card>
    </div>
  );
}
