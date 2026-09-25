import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { uploadSignatureToStorage } from '@/lib/docsign/uploadSignatureToStorage';

export interface UserSignature {
  id: string;
  user_id: string | null;
  signer_email: string | null;
  signature_type: 'draw' | 'type' | 'upload';
  signature_data: string;
  storage_url: string | null;
  font_family: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useUserSignatures() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-signatures', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_signatures')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as UserSignature[];
    },
    enabled: !!user?.id,
  });
}

export function useDefaultSignature() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['default-signature', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_signatures')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      if (error) throw error;
      return data as UserSignature | null;
    },
    enabled: !!user?.id,
  });
}

export function useSaveSignature() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      signatureData, 
      signatureType, 
      fontFamily,
      setAsDefault = true 
    }: { 
      signatureData: string; 
      signatureType: 'draw' | 'type' | 'upload';
      fontFamily?: string;
      setAsDefault?: boolean;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Upload signature to storage bucket instead of storing base64 in DB
      const { storageUrl, error: uploadError } = await uploadSignatureToStorage(
        user.id,
        signatureData,
        signatureType
      );
      
      if (uploadError) {
        console.warn('[useSaveSignature] Storage upload failed, falling back to base64:', uploadError);
        // Fall back to storing base64 in signature_data if storage fails
      }
      
      // If setting as default, first clear other defaults
      if (setAsDefault) {
        await supabase
          .from('user_signatures')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }
      
      const { data, error } = await supabase
        .from('user_signatures')
        .insert({
          user_id: user.id,
          signer_email: user.email,
          signature_type: signatureType,
          // If storage succeeded, use storage URL; otherwise fallback to base64
          signature_data: storageUrl ? '' : signatureData,
          storage_url: storageUrl || null,
          font_family: fontFamily || null,
          is_default: setAsDefault,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-signatures'] });
      queryClient.invalidateQueries({ queryKey: ['default-signature'] });
      toast.success('Signature saved successfully');
    },
    onError: (error) => {
      toast.error('Failed to save signature: ' + error.message);
    },
  });
}

export function useDeleteSignature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (signatureId: string) => {
      const { error } = await supabase
        .from('user_signatures')
        .delete()
        .eq('id', signatureId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-signatures'] });
      queryClient.invalidateQueries({ queryKey: ['default-signature'] });
      toast.success('Signature deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete signature: ' + error.message);
    },
  });
}
