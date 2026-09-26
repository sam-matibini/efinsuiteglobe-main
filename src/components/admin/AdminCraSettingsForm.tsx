import { useEffect, useState } from 'react';
import { Eye, EyeOff, Landmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { missingCraSettingsFunction, normalizeFirmName, validateCraFirmInput } from '@/lib/cra/firmSettings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StoredFirmSettings {
  representativeName: string;
  representativeId: string;
  efileName: string;
  efileNumber: string;
  passwordConfigured: boolean;
  updatedAt: string | null;
}

const EMPTY: StoredFirmSettings = {
  representativeName: '',
  representativeId: '',
  efileName: '',
  efileNumber: '',
  passwordConfigured: false,
  updatedAt: null,
};

export function AdminCraSettingsForm() {
  const [stored, setStored] = useState<StoredFirmSettings>(EMPTY);
  const [representativeName, setRepresentativeName] = useState('');
  const [representativeId, setRepresentativeId] = useState('');
  const [efileName, setEfileName] = useState('');
  const [efileNumber, setEfileNumber] = useState('');
  const [efilePassword, setEfilePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadStored()
      .then((next) => {
        if (cancelled || !next) return;
        setStored(next);
        setRepresentativeName(next.representativeName);
        setRepresentativeId(next.representativeId);
        setEfileName(next.efileName);
        setEfileNumber(next.efileNumber);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'CRA settings could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    const validation = validateCraFirmInput({ representativeName, representativeId, efileName, efileNumber, efilePassword });
    if (validation) {
      toast.error(validation);
      return;
    }
    setSaving(true);
    try {
      const next = await saveStored({
        representativeName: normalizeFirmName(representativeName),
        representativeId: representativeId.trim(),
        efileName: normalizeFirmName(efileName),
        efileNumber: efileNumber.trim(),
        efilePassword,
      }, stored.passwordConfigured);
      setStored(next);
      setRepresentativeName(next.representativeName);
      setRepresentativeId(next.representativeId);
      setEfileName(next.efileName);
      setEfileNumber(next.efileNumber);
      setEfilePassword('');
      setShowPassword(false);
      toast.success('Tax & CRA settings saved. Filing, enquiries, and remittances will use them.');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'CRA settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="w-5 h-5" />
          Firm CRA credentials
        </CardTitle>
        <CardDescription>
          Representative name and ID, plus the name and number registered for EFILE. These are the firm’s credentials, not a client’s CRA password.
          Filing and Client Data Enquiry send these names when eFinsuite contacts CRA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading CRA settings…
          </div>
        ) : (
          <>
            {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cra-representative-name">CRA representative name</Label>
                <Input
                  id="cra-representative-name"
                  value={representativeName}
                  autoComplete="organization"
                  onChange={(event) => setRepresentativeName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cra-representative-id">CRA representative ID</Label>
                <Input
                  id="cra-representative-id"
                  value={representativeId}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setRepresentativeId(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cra-efile-name">EFILE name</Label>
                <Input
                  id="cra-efile-name"
                  value={efileName}
                  autoComplete="organization"
                  onChange={(event) => setEfileName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cra-efile-number">EFILE number</Label>
                <Input
                  id="cra-efile-number"
                  value={efileNumber}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setEfileNumber(event.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The representative name is the name on the CRA Rep ID. The EFILE name is the name registered with the EFILE number. Both are included when eFinsuite contacts CRA. A blank name keeps the one already stored.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="cra-efile-password">EFILE password</Label>
                <Badge variant="outline">{stored.passwordConfigured ? 'Password saved' : 'No password saved'}</Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  id="cra-efile-password"
                  type={showPassword ? 'text' : 'password'}
                  value={efilePassword}
                  autoComplete="new-password"
                  placeholder={stored.passwordConfigured ? 'Leave blank to keep the saved password' : 'EFILE software password'}
                  onChange={(event) => setEfilePassword(event.target.value)}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide EFILE password' : 'Show EFILE password'}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The password is not shown again after you save it. A blank password keeps the one already stored.
              </p>
            </div>
            {stored.updatedAt ? (
              <p className="text-xs text-muted-foreground">Last saved {new Date(stored.updatedAt).toLocaleString()}.</p>
            ) : null}
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Tax & CRA settings
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

async function loadStored(): Promise<StoredFirmSettings> {
  const rpc = supabase as unknown as RpcClient;
  const { data, error } = await rpc.rpc('admin_get_cra_firm_settings');
  if (!error) return fromPublicRow(data);
  if (!missingCraSettingsFunction(error.message)) throw new Error(error.message);
  const { data: rows, error: readError } = await supabase
    .from('platform_settings')
    .select('setting_value, updated_at')
    .eq('setting_key', 'cra_firm_settings')
    .limit(1);
  if (readError) throw new Error(readError.message);
  const row = rows?.[0];
  const value = row?.setting_value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY;
  const record = value as Record<string, unknown>;
  return {
    representativeName: typeof record.representative_name === 'string' ? record.representative_name : '',
    representativeId: typeof record.representative_id === 'string' ? record.representative_id : '',
    efileName: typeof record.efile_name === 'string' ? record.efile_name : '',
    efileNumber: typeof record.efile_number === 'string' ? record.efile_number : '',
    passwordConfigured: typeof record.efile_password === 'string' && record.efile_password.length > 0,
    updatedAt: row.updated_at ?? null,
  };
}

async function saveStored(input: { representativeName: string; representativeId: string; efileName: string; efileNumber: string; efilePassword: string }, passwordConfigured: boolean): Promise<StoredFirmSettings> {
  const rpc = supabase as unknown as RpcClient;
  const { data, error } = await rpc.rpc('admin_save_cra_firm_settings', {
    _representative_name: input.representativeName,
    _representative_id: input.representativeId,
    _efile_name: input.efileName,
    _efile_number: input.efileNumber,
    _efile_password: input.efilePassword,
  });
  if (!error) {
    await supabase.from('platform_settings').delete().eq('setting_key', 'cra_firm_settings');
    return fromPublicRow(data);
  }
  if (!missingCraSettingsFunction(error.message)) throw new Error(error.message);

  const existing = await existingFallback();
  let efilePassword = input.efilePassword;
  if (!efilePassword && passwordConfigured && typeof existing.efile_password === 'string') {
    efilePassword = existing.efile_password;
  }
  const representativeName = input.representativeName || textValue(existing.representative_name);
  const efileName = input.efileName || textValue(existing.efile_name);
  const settingValue = {
    representative_name: representativeName,
    representative_id: input.representativeId,
    efile_name: efileName,
    efile_number: input.efileNumber,
    efile_password: efilePassword,
  };
  const { error: writeError } = await supabase
    .from('platform_settings')
    .upsert({ setting_key: 'cra_firm_settings', category: 'tax', setting_value: settingValue }, { onConflict: 'setting_key' });
  if (writeError) throw new Error(writeError.message);
  return {
    representativeName,
    representativeId: input.representativeId,
    efileName,
    efileNumber: input.efileNumber,
    passwordConfigured: efilePassword.length > 0 || passwordConfigured,
    updatedAt: new Date().toISOString(),
  };
}

async function existingFallback(): Promise<Record<string, unknown>> {
  const { data: rows } = await supabase
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'cra_firm_settings')
    .limit(1);
  const value = rows?.[0]?.setting_value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function fromPublicRow(data: unknown): StoredFirmSettings {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return EMPTY;
  const record = row as Record<string, unknown>;
  return {
    representativeName: typeof record.representative_name === 'string' ? record.representative_name : '',
    representativeId: typeof record.representative_id === 'string' ? record.representative_id : '',
    efileName: typeof record.efile_name === 'string' ? record.efile_name : '',
    efileNumber: typeof record.efile_number === 'string' ? record.efile_number : '',
    passwordConfigured: record.password_configured === true,
    updatedAt: typeof record.updated_at === 'string' ? record.updated_at : null,
  };
}

interface RpcClient {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}
