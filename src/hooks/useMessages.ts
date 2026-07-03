import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';

export type MessageChannel = 'sms' | 'whatsapp' | 'email' | 'in_app';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'received';

export interface Message {
  id: string;
  organization_id: string;
  conversation_id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  from_identifier: string;
  to_identifier: string;
  subject: string | null;
  body: string;
  media_urls: string[] | null;
  status: MessageStatus;
  external_id: string | null;
  is_read: boolean;
  read_at: string | null;
  error_message: string | null;
  sent_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  organization_id: string;
  contact_identifier: string;
  contact_name: string | null;
  channel: MessageChannel;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

interface UseMessagesOptions {
  autoSubscribe?: boolean;
}

export function useMessages(options: UseMessagesOptions = {}) {
  const { autoSubscribe = true } = options;
  const { currentOrganization } = useOrganizationContext();
  const organizationId = currentOrganization?.id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!organizationId) return;

    setIsLoadingConversations(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Cast the data to handle the enum types
      const typedData = (data || []).map(conv => ({
        ...conv,
        channel: conv.channel as MessageChannel,
      }));

      setConversations(typedData);
      
      // Calculate total unread
      const unread = typedData.reduce((sum, c) => sum + (c.unread_count || 0), 0);
      setTotalUnreadCount(unread);
    } catch (err: any) {
      console.error('Error fetching conversations:', err);
      toast.error('Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  }, [organizationId]);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Cast the data to handle the enum types
      const typedData = (data || []).map(msg => ({
        ...msg,
        channel: msg.channel as MessageChannel,
        direction: msg.direction as MessageDirection,
        status: msg.status as MessageStatus,
      }));

      setMessages(typedData);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('is_read', false)
        .eq('direction', 'inbound');

      if (error) throw error;

      // Update local state
      setMessages(prev => 
        prev.map(m => 
          m.conversation_id === conversationId && !m.is_read && m.direction === 'inbound'
            ? { ...m, is_read: true, read_at: new Date().toISOString() }
            : m
        )
      );

      // Update conversation unread count locally
      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        )
      );

      // Recalculate total
      setTotalUnreadCount(prev => {
        const conv = conversations.find(c => c.id === conversationId);
        return prev - (conv?.unread_count || 0);
      });
    } catch (err: any) {
      console.error('Error marking messages as read:', err);
    }
  }, [conversations]);

  // Normalize phone number to E.164 format
  const normalizePhoneNumber = useCallback((phone: string): string => {
    // Remove all non-digit characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If no + prefix and looks like a North American number, add +1
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10) {
        cleaned = '+1' + cleaned;
      } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }
    
    return cleaned;
  }, []);

  // Send a message
  const sendMessage = useCallback(async (
    channel: MessageChannel,
    to: string,
    body: string,
    options?: {
      subject?: string;
      mediaUrls?: string[];
    }
  ) => {
    if (!organizationId) {
      toast.error('No organization selected');
      return null;
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to send messages');
        return null;
      }

      // Normalize phone number for SMS/WhatsApp
      const normalizedTo = (channel === 'sms' || channel === 'whatsapp') 
        ? normalizePhoneNumber(to) 
        : to;

      // Find or create conversation
      let conversationId: string;
      
      const { data: existingConvo } = await supabase
        .from('conversations')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('contact_identifier', normalizedTo)
        .eq('channel', channel)
        .maybeSingle();

      if (existingConvo) {
        conversationId = existingConvo.id;
      } else {
        const { data: newConvo, error: convoError } = await supabase
          .from('conversations')
          .insert({
            organization_id: organizationId,
            contact_identifier: normalizedTo,
            channel: channel,
          })
          .select('id')
          .single();

        if (convoError) throw convoError;
        conversationId = newConvo.id;
      }

      // Get our phone number for 'from' field
      const fromNumber = channel === 'email' 
        ? 'info@efinsuite.com' 
        : '+17789020442'; // Default Twilio number

      // Insert the outbound message
      const { data: newMessage, error: msgError } = await supabase
        .from('messages')
        .insert({
          organization_id: organizationId,
          conversation_id: conversationId,
          channel: channel,
          direction: 'outbound',
          from_identifier: fromNumber,
          to_identifier: normalizedTo,
          subject: options?.subject || null,
          body: body,
          media_urls: options?.mediaUrls || null,
          status: 'pending',
          sent_by: user.id,
        })
        .select()
        .single();

      if (msgError) throw msgError;

      // Actually send via the appropriate channel
      let sendResult: { success: boolean; messageId?: string; error?: string };

      if (channel === 'sms') {
        const { data, error } = await supabase.functions.invoke('twilio-send-message', {
          body: { action: 'send', channel: 'sms', to: normalizedTo, message: body, mediaUrls: options?.mediaUrls },
        });
        sendResult = error ? { success: false, error: error.message } : data;
      } else if (channel === 'whatsapp') {
        const { data, error } = await supabase.functions.invoke('twilio-send-message', {
          body: { action: 'send', channel: 'whatsapp', to: normalizedTo, message: body },
        });
        sendResult = error ? { success: false, error: error.message } : data;
      } else if (channel === 'email') {
        const { data, error } = await supabase.functions.invoke('resend-integration', {
          body: { action: 'send-email', to, subject: options?.subject || 'Message', message: body },
        });
        sendResult = error ? { success: false, error: error.message } : data;
      } else {
        sendResult = { success: true }; // in_app messages don't need external sending
      }

      // Update message status
      const newStatus: MessageStatus = sendResult.success ? 'sent' : 'failed';
      await supabase
        .from('messages')
        .update({ 
          status: newStatus, 
          external_id: sendResult.messageId || null,
          error_message: sendResult.error || null,
        })
        .eq('id', newMessage.id);

      if (sendResult.success) {
        toast.success(`${channel.toUpperCase()} sent successfully`);
      } else {
        toast.error(`Failed to send: ${sendResult.error}`);
      }

      // Refresh conversations
      await fetchConversations();

      return { ...newMessage, status: newStatus };
    } catch (err: any) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
      return null;
    }
  }, [organizationId, fetchConversations]);

  // Select a conversation and load its messages
  const selectConversation = useCallback(async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    await fetchMessages(conversation.id);
    
    // Mark messages as read when conversation is selected
    if (conversation.unread_count > 0) {
      await markMessagesAsRead(conversation.id);
    }
  }, [fetchMessages, markMessagesAsRead]);

  // Realtime subscriptions
  useEffect(() => {
    if (!organizationId || !autoSubscribe) return;

    let messagesChannel: RealtimeChannel;
    let conversationsChannel: RealtimeChannel;

    const setupSubscriptions = () => {
      // Subscribe to new messages
      messagesChannel = supabase
        .channel(`messages-${organizationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `organization_id=eq.${organizationId}`,
          },
          (payload) => {
            const newMessage = {
              ...payload.new,
              channel: payload.new.channel as MessageChannel,
              direction: payload.new.direction as MessageDirection,
              status: payload.new.status as MessageStatus,
            } as Message;
            
            // Add to messages if we're viewing the conversation
            if (selectedConversation?.id === newMessage.conversation_id) {
              setMessages(prev => [...prev, newMessage]);
            }

            // Play sound for inbound messages
            if (newMessage.direction === 'inbound') {
              toast.info(`New ${newMessage.channel} message received`, {
                description: newMessage.body.substring(0, 50) + '...',
              });
            }
          }
        )
        .subscribe();

      // Subscribe to conversation updates
      conversationsChannel = supabase
        .channel(`conversations-${organizationId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `organization_id=eq.${organizationId}`,
          },
          () => {
            // Refresh conversations on any change
            fetchConversations();
          }
        )
        .subscribe();
    };

    setupSubscriptions();

    return () => {
      if (messagesChannel) supabase.removeChannel(messagesChannel);
      if (conversationsChannel) supabase.removeChannel(conversationsChannel);
    };
  }, [organizationId, autoSubscribe, selectedConversation, fetchConversations]);

  // Initial fetch
  useEffect(() => {
    if (organizationId) {
      fetchConversations();
    }
  }, [organizationId, fetchConversations]);

  return {
    conversations,
    messages,
    selectedConversation,
    isLoadingConversations,
    isLoadingMessages,
    totalUnreadCount,
    fetchConversations,
    fetchMessages,
    selectConversation,
    sendMessage,
    markMessagesAsRead,
    setSelectedConversation,
  };
}
