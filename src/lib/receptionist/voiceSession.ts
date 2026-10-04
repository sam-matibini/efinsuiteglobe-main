import { Conversation } from '@elevenlabs/client';

export interface VoiceSessionHandlers {
  signedUrl?: string | null;
  conversationToken?: string | null;
  clientTools: Record<string, (parameters: Record<string, unknown>) => Promise<string>>;
  onMessage: (message: { source: 'user' | 'ai'; text: string }) => void;
  onStatus: (status: string) => void;
  onError: (message: string) => void;
  onDisconnect: () => void;
}

export async function startVoiceSession(handlers: VoiceSessionHandlers) {
  const callbacks = {
    clientTools: handlers.clientTools,
    onMessage: (payload: { source?: 'user' | 'ai'; message?: string }) => {
      if (payload.message) handlers.onMessage({ source: payload.source === 'user' ? 'user' : 'ai', text: payload.message });
    },
    onStatusChange: ({ status }: { status: string }) => handlers.onStatus(status),
    onError: (message: string) => handlers.onError(message),
    onDisconnect: () => handlers.onDisconnect(),
  };
  if (handlers.conversationToken) {
    return Conversation.startSession({ conversationToken: handlers.conversationToken, ...callbacks });
  }
  if (handlers.signedUrl) {
    return Conversation.startSession({ signedUrl: handlers.signedUrl, connectionType: 'websocket', ...callbacks });
  }
  throw new Error('ElevenLabs did not return a voice session.');
}
