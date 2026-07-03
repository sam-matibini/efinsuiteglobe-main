import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import {
  useInstalledIntegrations, useIntegrationApiKeys, useIntegrationEventLog, type OrgInstallation,
} from '@/hooks/useMarketplace';
import { format } from 'date-fns';
import { Copy, Trash2, Power, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

function KeysPanel({ install }: { install: OrgInstallation }) {
  const { keys, create, revoke } = useIntegrationApiKeys(install.id, install.organization_id);
  const [label, setLabel] = useState('default');
  const [newKey, setNewKey] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Key label" /></div>
        <Button onClick={async () => {
          const r = await create.mutateAsync(label);
          setNewKey((r as { plaintext: string }).plaintext);
        }}><KeyRound className="h-3 w-3 mr-1" />Generate</Button>
      </div>
      {newKey && (
        <div className="rounded border border-dashed p-3 bg-muted/40">
          <div className="text-xs text-muted-foreground mb-1">Copy this key now — it will not be shown again.</div>
          <div className="flex gap-2 items-center">
            <code className="text-xs flex-1 break-all">{newKey}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newKey); toast.success('Copied'); }}><Copy className="h-3 w-3" /></Button>
          </div>
        </div>
      )}
      <ul className="divide-y text-sm">
        {keys.map((k) => (
          <li key={k.id} className="py-2 flex items-center justify-between">
            <div>
              <div className="font-mono text-xs">{k.key_prefix}.****</div>
              <div className="text-xs text-muted-foreground">{k.label} · created {format(new Date(k.created_at), 'PP')}</div>
            </div>
            {k.revoked_at ? <Badge variant="outline">Revoked</Badge> : (
              <Button size="sm" variant="ghost" onClick={() => revoke.mutate(k.id)}><Trash2 className="h-3 w-3" /></Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InstalledIntegrations() {
  const { currentOrganization } = useOrganizationContext();
  const { installations, isLoading, setStatus, remove } = useInstalledIntegrations(currentOrganization?.id);
  const { data: events = [] } = useIntegrationEventLog(currentOrganization?.id);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Installed Integrations</h1>
        <p className="text-muted-foreground">Manage active integrations, API keys and event delivery.</p>
      </div>

      <Tabs defaultValue="installed">
        <TabsList>
          <TabsTrigger value="installed">Installed ({installations.length})</TabsTrigger>
          <TabsTrigger value="events">Event log ({events.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="space-y-3 pt-4">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
            installations.length === 0 ? <p className="text-sm text-muted-foreground">No integrations installed yet.</p> :
            installations.map((i) => (
              <Card key={i.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{i.marketplace_integrations?.name}</CardTitle>
                    <div className="flex gap-2 items-center">
                      <Badge variant={i.status === 'active' ? 'default' : 'secondary'}>{i.status}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: i.id, status: i.status === 'active' ? 'paused' : 'active' })}>
                        <Power className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate(i.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {i.webhook_url && <div className="text-xs text-muted-foreground">Webhook: <code>{i.webhook_url}</code></div>}
                  <Dialog>
                    <DialogTrigger asChild><Button size="sm" variant="outline">Manage API keys</Button></DialogTrigger>
                    <DialogContent className="max-w-xl">
                      <DialogHeader><DialogTitle>API keys — {i.marketplace_integrations?.name}</DialogTitle></DialogHeader>
                      <KeysPanel install={i} />
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="events" className="pt-4">
          <Card><CardContent className="pt-6">
            <ul className="divide-y text-sm">
              {events.length === 0 ? <li className="py-2 text-muted-foreground">No events yet.</li> :
                events.map((e: any) => (
                  <li key={e.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{e.event_type}</div>
                      <div className="text-xs text-muted-foreground">{e.direction} · {format(new Date(e.created_at), 'PPp')}</div>
                    </div>
                    <Badge variant={e.status === 'ok' ? 'default' : 'destructive'}>{e.status} {e.http_status ?? ''}</Badge>
                  </li>
                ))}
            </ul>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
