import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Pencil, Check, X, Upload, Download, FileUp } from 'lucide-react';
import { useJobSites, type JobSite } from '@/hooks/useJobSites';
import {
  downloadJobSitesTemplate,
  parseJobSitesFile,
  parsePastedJobSites,
  exportFailedJobSitesCsv,
  validateRows,
  type ValidatedRow,
} from '@/lib/jobSitesBulk';
import { toast } from 'sonner';

export function JobSitesSettingsTab() {
  const { jobSites, isLoading, createSite, updateSite, deleteSite } = useJobSites();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return;
    await createSite.mutateAsync({ name, code: code || null });
    setName('');
    setCode('');
  };

  const startEdit = (site: JobSite) => {
    setEditingId(site.id);
    setEditName(site.name);
    setEditCode(site.code || '');
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await updateSite.mutateAsync({ id, name: editName.trim(), code: editCode.trim() || null });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Job Sites / Locations
          </CardTitle>
          <CardDescription>
            Manage the list of physical job sites or work locations. Employees must be assigned
            to a site during onboarding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add new */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="site-name">Site name *</Label>
              <Input
                id="site-name"
                placeholder="e.g. Head Office, Lagos Branch, Site A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-code">Code (optional)</Label>
              <Input
                id="site-code"
                placeholder="e.g. HQ"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={20}
              />
            </div>
            <Button onClick={handleAdd} disabled={!name.trim() || createSite.isPending}>
              <Plus className="w-4 h-4 mr-2" />
              Add site
            </Button>
          </div>

          {/* List */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-32">Code</TableHead>
                  <TableHead className="w-32">Active</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : jobSites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      No job sites yet. Add one above to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobSites.map((site) => {
                    const editing = editingId === site.id;
                    return (
                      <TableRow key={site.id}>
                        <TableCell>
                          {editing ? (
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              maxLength={120}
                            />
                          ) : (
                            <span className="font-medium">{site.name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editing ? (
                            <Input
                              value={editCode}
                              onChange={(e) => setEditCode(e.target.value)}
                              maxLength={20}
                            />
                          ) : (
                            site.code || <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={site.is_active}
                              onCheckedChange={(v) =>
                                updateSite.mutate({ id: site.id, is_active: v })
                              }
                            />
                            {site.is_active ? (
                              <Badge variant="secondary">Active</Badge>
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {editing ? (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => saveEdit(site.id)}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => startEdit(site)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Delete "${site.name}"? Employees assigned to this site must be reassigned first.`,
                                    )
                                  ) {
                                    deleteSite.mutate(site.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default JobSitesSettingsTab;
