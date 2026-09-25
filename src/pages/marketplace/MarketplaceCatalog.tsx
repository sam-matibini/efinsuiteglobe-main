import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useMarketplaceCatalog, useInstalledIntegrations, type MarketplaceIntegration } from '@/hooks/useMarketplace';
import { Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MarketplaceCatalog() {
  const { currentOrganization } = useOrganizationContext();
  const { data: catalog = [], isLoading } = useMarketplaceCatalog();
  const { installations, install } = useInstalledIntegrations(currentOrganization?.id);
  const installedIds = new Set(installations.map((i) => i.integration_id));

  const [open, setOpen] = useState<MarketplaceIntegration | null>(null);
  const [webhook, setWebhook] = useState('');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integration Marketplace</h1>
          <p className="text-muted-foreground">Connect treasury events to outside tools or build your own with our public API.</p>
        </div>
        <Button asChild variant="outline"><Link to="/marketplace/installed">Manage installed</Link></Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading catalog…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{c.name}</CardTitle>
                  <Badge variant="outline">{c.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{c.description}</p>
                <div className="flex flex-wrap gap-1">{c.scopes.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
                {installedIds.has(c.id) ? (
                  <Button variant="outline" disabled className="w-full">Installed</Button>
                ) : c.delivery === 'webhook' ? (
                  <Dialog open={open?.id === c.id} onOpenChange={(o) => setOpen(o ? c : null)}>
                    <DialogTrigger asChild><Button className="w-full">Install</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Install {c.name}</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label>Webhook URL</Label>
                          <Input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://…" />
                        </div>
                        <Button className="w-full" onClick={() => {
                          install.mutate({ integration_id: c.id, webhook_url: webhook, config: {} });
                          setOpen(null); setWebhook('');
                        }}>Install <LinkIcon className="h-3 w-3 ml-1" /></Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button className="w-full" onClick={() => install.mutate({ integration_id: c.id, config: {} })}>Install</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
