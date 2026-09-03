import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, Plus, FileText } from 'lucide-react';
import { useVendorTaxProfiles, type VendorTaxProfile } from '@/hooks/useVendorTaxProfiles';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useQuery } from '@tanstack/react-query';

function statusBadge(status: string) {
  if (status === 'format_valid') return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3"/>Format valid</Badge>;
  if (status === 'invalid') return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3"/>Invalid</Badge>;
  return <Badge variant="outline">Unverified</Badge>;
}

export default function VendorTaxProfiles() {
  const { profiles, isLoading, upsert, runTinMatch } = useVendorTaxProfiles();
  const { currentOrganization } = useOrganizationContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<VendorTaxProfile>>({ country: 'CA' });
  const [query, setQuery] = useState('');

  const vendors = useQuery({
    queryKey: ['vendors-lite', currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('vendors')
        .select('id, name, country, tax_number, is_contractor')
        .eq('organization_id', currentOrganization!.id)
        .eq('is_active', true)
        .order('name');
      return data ?? [];
    },
  });

  const enriched = useMemo(() => {
    const map = new Map(profiles.map((p) => [p.vendor_id, p]));
    return (vendors.data ?? [])
      .filter((v) => !query || v.name?.toLowerCase().includes(query.toLowerCase()))
      .map((v) => ({ vendor: v, profile: map.get(v.id) }));
  }, [vendors.data, profiles, query]);

  function openFor(vendorId: string, existing?: VendorTaxProfile) {
    setForm(existing ?? { vendor_id: vendorId, country: 'CA' });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.vendor_id) return;
    await upsert.mutateAsync(form as any);
    setDialogOpen(false);
    setForm({ country: 'CA' });
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendor Tax Profiles</h1>
          <p className="text-muted-foreground">W-9 / W-8 / TD1 metadata and TIN/SIN validation status.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runTinMatch.mutate(undefined)} disabled={runTinMatch.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${runTinMatch.isPending ? 'animate-spin' : ''}`}/>
            Run TIN/SIN match (all)
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Vendors</CardTitle>
          <Input placeholder="Search vendors" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs"/>
        </CardHeader>
        <CardContent>
          {isLoading || vendors.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Slip type</TableHead>
                  <TableHead>TIN/SIN status</TableHead>
                  <TableHead>Last checked</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map(({ vendor, profile }) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell>{profile?.country ?? vendor.country ?? 'CA'}</TableCell>
                    <TableCell>{profile?.slip_type_override ?? (vendor.is_contractor ? 'T5018' : '—')}</TableCell>
                    <TableCell>{statusBadge(profile?.tin_match_status ?? 'unverified')}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {profile?.tin_match_checked_at ? new Date(profile.tin_match_checked_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openFor(vendor.id, profile)}>
                        {profile ? <FileText className="mr-2 h-3 w-3"/> : <Plus className="mr-2 h-3 w-3"/>}
                        {profile ? 'Edit' : 'Add'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {enriched.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No vendors</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Vendor tax profile</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Country</Label>
                <Select value={form.country ?? 'CA'} onValueChange={(v) => setForm({ ...form, country: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="CA">Canada</SelectItem><SelectItem value="US">United States</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Slip type override</Label>
                <Select value={form.slip_type_override ?? 'auto'} onValueChange={(v) => setForm({ ...form, slip_type_override: v === 'auto' ? null : v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="T4A">T4A</SelectItem>
                    <SelectItem value="T5018">T5018</SelectItem>
                    <SelectItem value="T5">T5</SelectItem>
                    <SelectItem value="1099-NEC">1099-NEC</SelectItem>
                    <SelectItem value="1099-MISC">1099-MISC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Legal name</Label>
              <Input value={form.legal_name ?? ''} onChange={(e) => setForm({ ...form, legal_name: e.target.value })}/>
            </div>
            {form.country === 'CA' ? (
              <>
                <div><Label>SIN (9 digits)</Label><Input value={form.sin ?? ''} onChange={(e) => setForm({ ...form, sin: e.target.value })}/></div>
                <div><Label>Business Number</Label><Input value={form.business_number ?? ''} onChange={(e) => setForm({ ...form, business_number: e.target.value })}/></div>
              </>
            ) : (
              <>
                <div><Label>TIN / EIN</Label><Input value={form.tin ?? form.ein ?? ''} onChange={(e) => setForm({ ...form, tin: e.target.value })}/></div>
                <div>
                  <Label>W-form type</Label>
                  <Select value={form.w_form_type ?? 'W-9'} onValueChange={(v) => setForm({ ...form, w_form_type: v })}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="W-9">W-9</SelectItem><SelectItem value="W-8BEN">W-8BEN</SelectItem><SelectItem value="W-8BEN-E">W-8BEN-E</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div><Label>Address line 1</Label><Input value={form.address_line1 ?? ''} onChange={(e) => setForm({ ...form, address_line1: e.target.value })}/></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>City</Label><Input value={form.city ?? ''} onChange={(e) => setForm({ ...form, city: e.target.value })}/></div>
              <div><Label>State/Prov</Label><Input value={form.state_province ?? ''} onChange={(e) => setForm({ ...form, state_province: e.target.value })}/></div>
              <div><Label>Postal</Label><Input value={form.postal_code ?? ''} onChange={(e) => setForm({ ...form, postal_code: e.target.value })}/></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={upsert.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
