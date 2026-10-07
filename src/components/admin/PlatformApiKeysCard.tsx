import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PLATFORM_API_PRESETS, normalizeSecretName, validatePlatformApi, type PlatformApiPublic } from '@/lib/platformApis';
import { deletePlatformApi, listPlatformApis, savePlatformApi, setPlatformApiEnabled, testPlatformApi } from '@/lib/platformApisClient';

const elevenLabs = PLATFORM_API_PRESETS[0];

export function PlatformApiKeysCard() {
  const [keys, setKeys] = useState<PlatformApiPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<string>('elevenlabs');
  const [label, setLabel] = useState(elevenLabs.label);
  const [secretName, setSecretName] = useState(elevenLabs.secretName);
  const [secretValue, setSecretValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [formError, setFormError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      setKeys(await listPlatformApis());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load API keys.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const choose = (next: string) => {
    setPreset(next);
    setFormError('');
    setSecretValue('');
    const selected = PLATFORM_API_PRESETS.find((item) => item.provider === next);
    if (selected) {
      setLabel(selected.label);
      setSecretName(selected.secretName);
    } else {
      setLabel('');
      setSecretName('');
    }
  };

  const openDialog = () => {
    choose('elevenlabs');
    setShowKey(false);
    setOpen(true);
  };

  const onSave = async () => {
    const selected = PLATFORM_API_PRESETS.find((item) => item.provider === preset);
    const input = {
      provider: preset,
      label: label.trim(),
      secretName: selected ? selected.secretName : normalizeSecretName(secretName),
      secretValue,
      docsUrl: selected?.docsUrl ?? null,
    };
    const problem = validatePlatformApi(input);
    if (problem) {
      setFormError(problem);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await savePlatformApi(input);
      setSecretValue('');
      setOpen(false);
      toast.success(`${input.label} API key saved`);
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save the API key.');
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    try {
      const message = await testPlatformApi({
        provider: preset,
        secretName: PLATFORM_API_PRESETS.find((item) => item.provider === preset)?.secretName ?? normalizeSecretName(secretName),
        secretValue,
      });
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not test the API key.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-primary" />
            Platform API keys
          </CardTitle>
          <CardDescription>
            Add an API such as ElevenLabs and paste its key. Organization owners can save it here. The key is not shown again after you save it.
          </CardDescription>
        </div>
        <Button onClick={openDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add API
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading API keys…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No API keys yet. Add ElevenLabs to answer calls by voice.</p>
        ) : (
          keys.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{item.label}</p>
                  <Badge variant="secondary">{item.enabled ? 'Enabled' : 'Off'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{item.secretName} · {item.hint || 'Saved'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={item.enabled}
                  aria-label={`Enable ${item.label}`}
                  onCheckedChange={async (enabled) => {
                    await setPlatformApiEnabled(item.id, enabled);
                    setKeys((current) => current.map((row) => (row.id === item.id ? { ...row, enabled } : row)));
                  }}
                />
                {item.secretName === 'ELEVENLABS_API_KEY' && (
                  <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      toast.success(await testPlatformApi({ secretName: item.secretName, provider: item.provider }));
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Could not test the API key.');
                    }
                  }}>Test</Button>
                )}
                <Button variant="ghost" size="icon" aria-label={`Remove ${item.label}`} onClick={async () => {
                  await deletePlatformApi(item.id);
                  setKeys((current) => current.filter((row) => row.id !== item.id));
                  toast.success(`${item.label} removed`);
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add API</DialogTitle>
            <DialogDescription>Choose ElevenLabs or another service, then paste the API key.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PLATFORM_API_PRESETS.map((item) => (
                <Button key={item.provider} type="button" variant={preset === item.provider ? 'default' : 'outline'} onClick={() => choose(item.provider)}>
                  {item.label}
                </Button>
              ))}
              <Button type="button" variant={preset === 'custom' ? 'default' : 'outline'} onClick={() => choose('custom')}>Custom API</Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-api-label">Name</Label>
              <Input id="platform-api-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="ElevenLabs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-api-secret-name">Secret name</Label>
              <Input
                id="platform-api-secret-name"
                value={secretName}
                onChange={(event) => setSecretName(normalizeSecretName(event.target.value))}
                placeholder="ELEVENLABS_API_KEY"
                disabled={preset !== 'custom'}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-api-key">API key</Label>
              <div className="relative">
                <Input
                  id="platform-api-key"
                  type={showKey ? 'text' : 'password'}
                  value={secretValue}
                  onChange={(event) => setSecretValue(event.target.value)}
                  placeholder="Paste the API key"
                  autoComplete="off"
                  className="pr-10 font-mono text-sm"
                />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" aria-label={showKey ? 'Hide API key' : 'Show API key'} onClick={() => setShowKey((current) => !current)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => void onTest()} disabled={testing}>
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test key
            </Button>
            <Button type="button" onClick={() => void onSave()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save API key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
