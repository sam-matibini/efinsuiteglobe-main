import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Image, FileSignature, MapPin, Settings2, FileText, Users } from 'lucide-react';
import { useCommunicationIdentity } from '@/hooks/useCommunicationIdentity';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { GeneralInfoTab } from './GeneralInfoTab';
import { LogoImagesTab } from './LogoImagesTab';
import { SignatureTab } from './SignatureTab';
import { ContactDetailsTab } from './ContactDetailsTab';
import { ChannelMappingTab } from './ChannelMappingTab';
import { SenderManagement } from './SenderManagement';
import { TemplateManagementPanel } from '../TemplateManagementPanel';
import { Skeleton } from '@/components/ui/skeleton';

export function BrandingSettingsPanel() {
  const { currentOrganization } = useOrganizationContext();
  const { identity, channels, isLoading, isSaving, saveIdentity, updateChannelConfig, uploadImage, getChannelEnabled } = useCommunicationIdentity();
  const [activeTab, setActiveTab] = useState('general');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Signature & Branding Settings
        </CardTitle>
        <CardDescription>
          Configure your organization's identity for emails, SMS, WhatsApp, PDFs, and e-signatures
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-7 mb-6">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="senders" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Senders</span>
            </TabsTrigger>
            <TabsTrigger value="logo" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Logo</span>
            </TabsTrigger>
            <TabsTrigger value="signature" className="flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              <span className="hidden sm:inline">Signature</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Contact</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="channels" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Channels</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralInfoTab
              identity={identity}
              isSaving={isSaving}
              onSave={saveIdentity}
            />
          </TabsContent>

          <TabsContent value="senders">
            <SenderManagement />
          </TabsContent>

          <TabsContent value="logo">
            <LogoImagesTab
              identity={identity}
              isSaving={isSaving}
              onSave={saveIdentity}
              onUpload={uploadImage}
            />
          </TabsContent>

          <TabsContent value="signature">
            <SignatureTab
              identity={identity}
              isSaving={isSaving}
              onSave={saveIdentity}
              onUpload={uploadImage}
              organizationId={currentOrganization?.id}
            />
          </TabsContent>

          <TabsContent value="contact">
            <ContactDetailsTab
              identity={identity}
              isSaving={isSaving}
              onSave={saveIdentity}
            />
          </TabsContent>

          <TabsContent value="templates">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Message Templates</h3>
                <p className="text-sm text-muted-foreground">
                  Create reusable message templates for quick communication across all channels.
                </p>
              </div>
              <TemplateManagementPanel />
            </div>
          </TabsContent>

          <TabsContent value="channels">
            <ChannelMappingTab
              channels={channels}
              getChannelEnabled={getChannelEnabled}
              onUpdateChannel={updateChannelConfig}
              hasIdentity={!!identity}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
