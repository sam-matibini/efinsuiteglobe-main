import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ApiCredentialDraft,
  ApiProvider,
  buildApiCredentialDraft,
  formatApiSettingsError,
} from '@/lib/receptionist/apiCredentials';

interface AddApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: ApiCredentialDraft) => Promise<void>;
  onTest: (draft: ApiCredentialDraft) => Promise<void>;
}

export function AddApiKeyDialog({ open, onOpenChange, onSave, onTest }: AddApiKeyDialogProps) {
  const [provider, setProvider] = useState<ApiProvider>('elevenlabs');
  const [name, setName] = useState('ElevenLabs');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const draft = buildApiCredentialDraft(provider, name, apiKey);

  const switchProvider = (next: ApiProvider) => {
    setProvider(next);
    setName(next === 'elevenlabs' ? 'ElevenLabs' : '');
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    if (!draft.apiKey) {
      setError('Paste an API key first.');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(draft);
      toast.success('API key saved for this organization');
      setApiKey('');
      onOpenChange(false);
    } catch (saveError) {
      const message = formatApiSettingsError(saveError);
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setError(null);
    if (!draft.apiKey) {
      setError('Paste an API key first.');
      return;
    }
    setIsTesting(true);
    try {
      await onTest(draft);
      toast.success('API key works');
    } catch (testError) {
      const message = formatApiSettingsError(testError);
      setError(message);
      toast.error(message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add API</DialogTitle>
          <DialogDescription>Choose ElevenLabs or another service, then paste the API key.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={provider === 'elevenlabs' ? 'default' : 'outline'}
            onClick={() => switchProvider('elevenlabs')}
          >
            ElevenLabs
          </Button>
          <Button
            type="button"
            variant={provider === 'custom' ? 'default' : 'outline'}
            onClick={() => switchProvider('custom')}
          >
            Custom API
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="api-name">Name</Label>
          <Input id="api-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="api-secret-name">Secret name</Label>
          <Input id="api-secret-name" value={draft.secretName} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="api-key">API key</Label>
          <div className="relative">
            <Input
              id="api-key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0"
              onClick={() => setShowKey((current) => !current)}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting || isSaving}>
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test key
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || isTesting}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save API key
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
