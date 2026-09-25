import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { CommunicationIdentity } from '@/hooks/useCommunicationIdentity';

interface GeneralInfoTabProps {
  identity: CommunicationIdentity | null;
  isSaving: boolean;
  onSave: (data: Partial<CommunicationIdentity>) => Promise<boolean>;
}

export function GeneralInfoTab({ identity, isSaving, onSave }: GeneralInfoTabProps) {
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('');

  useEffect(() => {
    if (identity) {
      setLegalName(identity.legal_name || '');
      setDisplayName(identity.display_name || '');
      setTagline(identity.tagline || '');
    }
  }, [identity]);

  const handleSave = async () => {
    await onSave({
      legal_name: legalName || undefined,
      display_name: displayName || undefined,
      tagline: tagline || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="legal-name">Legal Business Name *</Label>
          <Input
            id="legal-name"
            placeholder="Your Company Inc."
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The official registered name of your business
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display-name">Display Name</Label>
          <Input
            id="display-name"
            placeholder="Your Company"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            A shorter name to display in communications (optional)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            placeholder="Your trusted partner in..."
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            A brief slogan or description (optional)
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || !legalName}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
