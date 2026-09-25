import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirmWorkspaces, useFirmPortalSummary } from '@/hooks/useFirmPortal';
import { AlertCircle, Building2, Calendar, Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function FirmClients() {
  const { workspaces, isLoading, create, linkClient } = useFirmWorkspaces();
  const [selectedWsId, setSelectedWsId] = useState<string | undefined>();
  const [newName, setNewName] = useState('');
  const [linkOrgId, setLinkOrgId] = useState('');
  const activeWsId = selectedWsId ?? workspaces[0]?.id;
  const summary = useFirmPortalSummary(activeWsId);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Firm Portal — Clients</h1>
        <p className="text-muted-foreground mt-1">Aggregate view of every client organization your firm services.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : workspaces.length === 0 ? (
            <div className="flex gap-2">
              <Input placeholder="Firm name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Button onClick={() => newName && create.mutate(newName)} disabled={create.isPending}>
                <Plus className="h-4 w-4 mr-2" />Create workspace
              </Button>
            </div>
          ) : (
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground">Active workspace</label>
                <Select value={activeWsId} onValueChange={setSelectedWsId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {workspaces.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Client organization UUID"
                  value={linkOrgId}
                  onChange={(e) => setLinkOrgId(e.target.value)}
                  className="w-72"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (activeWsId && linkOrgId) {
                      linkClient.mutate({ workspace_id: activeWsId, organization_id: linkOrgId });
                      setLinkOrgId('');
                    }
                  }}
                  disabled={!activeWsId || !linkOrgId || linkClient.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />Link client
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client roster</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading client KPIs…</p>
          ) : (summary.data?.clients?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No clients linked yet. Paste a client organization UUID above to start.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Open alerts</TableHead>
                  <TableHead>Next due</TableHead>
                  <TableHead>Last consolidation</TableHead>
                  <TableHead>Last export</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.data!.clients.map((c) => (
                  <TableRow key={c.organization_id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      {c.critical_alerts > 0 ? (
                        <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{c.critical_alerts} critical</Badge>
                      ) : c.open_alerts > 0 ? (
                        <Badge variant="secondary">{c.open_alerts} open</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.next_due_date ? (
                        <span className="text-sm inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(c.next_due_date), 'MMM d, yyyy')}</span>
                      ) : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{c.last_consolidation_at ? format(new Date(c.last_consolidation_at), 'MMM d') : '—'}</TableCell>
                    <TableCell className="text-sm">{c.last_export_at ? format(new Date(c.last_export_at), 'MMM d') : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
