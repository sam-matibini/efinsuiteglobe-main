import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Phone, MessageCircle, FileText, PenTool, AlertCircle } from 'lucide-react';
import { IdentityChannel } from '@/hooks/useCommunicationIdentity';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ChannelMappingTabProps {
  channels: IdentityChannel[];
  getChannelEnabled: (channel: IdentityChannel['channel']) => boolean;
  onUpdateChannel: (
    channel: IdentityChannel['channel'],
    enabled: boolean,
    customSignatureHtml?: string,
    customSignaturePlain?: string
  ) => Promise<boolean>;
  hasIdentity: boolean;
}

const CHANNELS = [
  {
    id: 'email' as const,
    label: 'Email',
    description: 'Include branding and signature in email communications',
    icon: Mail,
    color: 'text-blue-500',
  },
  {
    id: 'sms' as const,
    label: 'SMS',
    description: 'Include short signature in text messages',
    icon: Phone,
    color: 'text-purple-500',
  },
  {
    id: 'whatsapp' as const,
    label: 'WhatsApp',
    description: 'Include branding in WhatsApp messages',
    icon: MessageCircle,
    color: 'text-green-500',
  },
  {
    id: 'pdf' as const,
    label: 'PDF Documents',
    description: 'Include logo and contact details in generated PDFs',
    icon: FileText,
    color: 'text-red-500',
  },
  {
    id: 'esign' as const,
    label: 'E-Signature',
    description: 'Include branding in e-signature workflows',
    icon: PenTool,
    color: 'text-amber-500',
  },
];

export function ChannelMappingTab({
  channels: _channels,
  getChannelEnabled,
  onUpdateChannel,
  hasIdentity,
}: ChannelMappingTabProps) {
  const [savingChannel, setSavingChannel] = useState<string | null>(null);

  const handleToggle = async (channelId: IdentityChannel['channel'], enabled: boolean) => {
    if (!hasIdentity) return;
    
    setSavingChannel(channelId);
    await onUpdateChannel(channelId, enabled);
    setSavingChannel(null);
  };

  if (!hasIdentity) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please save your general information first before configuring channel settings.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-medium">Channel Configuration</Label>
        <p className="text-sm text-muted-foreground">
          Enable or disable branding for each communication channel
        </p>
      </div>

      <div className="grid gap-4">
        {CHANNELS.map((channel) => {
          const isEnabled = getChannelEnabled(channel.id);
          const isSaving = savingChannel === channel.id;
          const Icon = channel.icon;

          return (
            <Card key={channel.id} className={isSaving ? 'opacity-50' : ''}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg bg-muted ${channel.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{channel.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {channel.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggle(channel.id, checked)}
                  disabled={isSaving}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          When enabled, your branding and signature will be automatically included in 
          communications sent through each channel. You can customize the signature 
          format for SMS and WhatsApp in the Signature tab.
        </p>
      </div>
    </div>
  );
}
