import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';

export interface CopilotMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

export interface CopilotConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  model: string;
}

export function useTreasuryCopilot(conversationId?: string) {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  const conversations = useQuery({
    queryKey: ['copilot_conversations', currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('copilot_conversations' as any)
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CopilotConversation[];
    },
  });

  const messages = useQuery({
    queryKey: ['copilot_messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('copilot_messages' as any)
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as CopilotMessage[];
    },
  });

  const createConversation = useMutation({
    mutationFn: async (title: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('copilot_conversations' as any)
        .insert({
          organization_id: currentOrganization!.id,
          user_id: u.user!.id,
          title,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CopilotConversation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['copilot_conversations'] }),
  });

  async function ask(input: string, history: CopilotMessage[]) {
    setPending(true);
    try {
      const { data, error } = await supabase.functions.invoke('treasury-copilot', {
        body: {
          organization_id: currentOrganization!.id,
          conversation_id: conversationId,
          messages: [...history, { role: 'user', content: input }],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ['copilot_messages', conversationId] });
      return data.message as string;
    } catch (e: any) {
      toast.error(e.message);
      throw e;
    } finally {
      setPending(false);
    }
  }

  return {
    conversations: conversations.data ?? [],
    messages: messages.data ?? [],
    isLoading: conversations.isLoading || messages.isLoading,
    pending,
    createConversation,
    ask,
  };
}
