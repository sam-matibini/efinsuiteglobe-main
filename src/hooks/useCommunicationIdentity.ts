import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';

export interface CommunicationIdentity {
  id: string;
  organization_id: string;
  department_id: string | null;
  user_id: string | null;
  display_name: string | null;
  legal_name: string | null;
  tagline: string | null;
  logo_url: string | null;
  logo_position: 'left' | 'center' | 'right';
  profile_image_url: string | null;
  signature_html: string | null;
  signature_image_url: string | null;
  signature_plain_text: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  is_default: boolean;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface IdentityChannel {
  id: string;
  communication_identity_id: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'pdf' | 'esign';
  enabled: boolean;
  custom_signature_html: string | null;
  custom_signature_plain: string | null;
}

interface IdentityFormData {
  display_name?: string;
  legal_name?: string;
  tagline?: string;
  logo_url?: string;
  logo_position?: 'left' | 'center' | 'right';
  profile_image_url?: string;
  signature_html?: string;
  signature_image_url?: string;
  signature_plain_text?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  is_default?: boolean;
}

export function useCommunicationIdentity() {
  const { currentOrganization } = useOrganizationContext();
  const [identity, setIdentity] = useState<CommunicationIdentity | null>(null);
  const [channels, setChannels] = useState<IdentityChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchIdentity = useCallback(async () => {
    if (!currentOrganization?.id) {
      setIdentity(null);
      setChannels([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch organization-level identity (default)
      const { data: identityData, error: identityError } = await supabase
        .from('communication_identity')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .is('department_id', null)
        .is('user_id', null)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (identityError) {
        console.error('Error fetching identity:', identityError);
        throw identityError;
      }

      if (identityData) {
        setIdentity(identityData as CommunicationIdentity);

        // Fetch channel configurations
        const { data: channelData, error: channelError } = await supabase
          .from('communication_identity_channels')
          .select('*')
          .eq('communication_identity_id', identityData.id);

        if (channelError) {
          console.error('Error fetching channels:', channelError);
        } else {
          setChannels(channelData as IdentityChannel[] || []);
        }
      } else {
        setIdentity(null);
        setChannels([]);
      }
    } catch (err) {
      console.error('Error in fetchIdentity:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  const saveIdentity = async (data: IdentityFormData): Promise<boolean> => {
    if (!currentOrganization?.id) {
      toast.error('No organization selected');
      return false;
    }

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (identity) {
        // Update existing
        const { error } = await supabase
          .from('communication_identity')
          .update({
            ...data,
            updated_by: userId,
          })
          .eq('id', identity.id);

        if (error) throw error;
        toast.success('Branding settings saved');
      } else {
        // Create new
        const { error } = await supabase
          .from('communication_identity')
          .insert({
            organization_id: currentOrganization.id,
            ...data,
            is_default: true,
            created_by: userId,
            updated_by: userId,
          });

        if (error) throw error;
        toast.success('Branding settings created');
      }

      await fetchIdentity();
      return true;
    } catch (err: any) {
      console.error('Error saving identity:', err);
      toast.error(err.message || 'Failed to save settings');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateChannelConfig = async (
    channel: IdentityChannel['channel'],
    enabled: boolean,
    customSignatureHtml?: string,
    customSignaturePlain?: string
  ): Promise<boolean> => {
    if (!identity) {
      toast.error('Please save general settings first');
      return false;
    }

    try {
      const existingChannel = channels.find(c => c.channel === channel);

      if (existingChannel) {
        const { error } = await supabase
          .from('communication_identity_channels')
          .update({
            enabled,
            custom_signature_html: customSignatureHtml,
            custom_signature_plain: customSignaturePlain,
          })
          .eq('id', existingChannel.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('communication_identity_channels')
          .insert({
            communication_identity_id: identity.id,
            channel,
            enabled,
            custom_signature_html: customSignatureHtml,
            custom_signature_plain: customSignaturePlain,
          });

        if (error) throw error;
      }

      await fetchIdentity();
      toast.success(`${channel.toUpperCase()} channel settings saved`);
      return true;
    } catch (err: any) {
      console.error('Error updating channel:', err);
      toast.error(err.message || 'Failed to update channel');
      return false;
    }
  };

  const uploadImage = async (file: File, type: 'logo' | 'profile' | 'signature'): Promise<string | null> => {
    if (!currentOrganization?.id) {
      toast.error('No organization selected');
      return null;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `branding/${currentOrganization.id}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      return urlData?.publicUrl || null;
    } catch (err: any) {
      console.error('Error uploading image:', err);
      toast.error('Failed to upload image');
      return null;
    }
  };

  const getChannelEnabled = (channel: IdentityChannel['channel']): boolean => {
    const channelConfig = channels.find(c => c.channel === channel);
    return channelConfig?.enabled ?? true; // Default to enabled
  };

  return {
    identity,
    channels,
    isLoading,
    isSaving,
    saveIdentity,
    updateChannelConfig,
    uploadImage,
    getChannelEnabled,
    refetch: fetchIdentity,
  };
}
