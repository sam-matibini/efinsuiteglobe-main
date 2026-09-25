-- Create enum for message channels
CREATE TYPE public.message_channel AS ENUM ('sms', 'whatsapp', 'email', 'in_app');

-- Create enum for message direction
CREATE TYPE public.message_direction AS ENUM ('inbound', 'outbound');

-- Create enum for message status
CREATE TYPE public.message_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'received');

-- Create conversations table to group messages by phone/email
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    contact_identifier TEXT NOT NULL, -- Phone number or email
    contact_name TEXT,
    channel message_channel NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_message_preview TEXT,
    unread_count INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    channel message_channel NOT NULL,
    direction message_direction NOT NULL,
    from_identifier TEXT NOT NULL, -- Phone number or email
    to_identifier TEXT NOT NULL,
    subject TEXT, -- For emails
    body TEXT NOT NULL,
    media_urls TEXT[], -- For MMS attachments
    status message_status DEFAULT 'pending',
    external_id TEXT, -- Twilio SID or SendGrid message ID
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    sent_by UUID REFERENCES auth.users(id), -- User who sent (for outbound)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_messages_organization ON public.messages(organization_id);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_channel ON public.messages(channel);
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);
CREATE INDEX idx_messages_unread ON public.messages(organization_id, is_read) WHERE is_read = false;
CREATE INDEX idx_conversations_organization ON public.conversations(organization_id);
CREATE INDEX idx_conversations_contact ON public.conversations(contact_identifier);
CREATE INDEX idx_conversations_last_message ON public.conversations(last_message_at DESC);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversations - org members can view
CREATE POLICY "Organization members can view conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = conversations.organization_id
        AND om.user_id = auth.uid()
    )
);

CREATE POLICY "Organization members can insert conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = conversations.organization_id
        AND om.user_id = auth.uid()
    )
);

CREATE POLICY "Organization members can update conversations"
ON public.conversations FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = conversations.organization_id
        AND om.user_id = auth.uid()
    )
);

-- RLS policies for messages - org members can view
CREATE POLICY "Organization members can view messages"
ON public.messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = messages.organization_id
        AND om.user_id = auth.uid()
    )
);

CREATE POLICY "Organization members can insert messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = messages.organization_id
        AND om.user_id = auth.uid()
    )
);

CREATE POLICY "Organization members can update messages"
ON public.messages FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = messages.organization_id
        AND om.user_id = auth.uid()
    )
);

-- Allow service role to insert (for webhooks)
CREATE POLICY "Service role can insert messages"
ON public.messages FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can insert conversations"
ON public.conversations FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update conversations"
ON public.conversations FOR UPDATE
TO service_role
USING (true);

-- Function to update conversation when message is inserted
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.conversations
    SET 
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.body, 100),
        unread_count = CASE 
            WHEN NEW.direction = 'inbound' AND NOT NEW.is_read 
            THEN unread_count + 1 
            ELSE unread_count 
        END,
        updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_conversation_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_on_message();

-- Function to reset unread count when messages are marked as read
CREATE OR REPLACE FUNCTION public.update_conversation_unread_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.is_read = false AND NEW.is_read = true THEN
        UPDATE public.conversations
        SET unread_count = GREATEST(0, unread_count - 1),
            updated_at = now()
        WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_conversation_unread
AFTER UPDATE OF is_read ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_unread_count();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;