import { Conversation } from '@elevenlabs/client';

export interface VoiceSessionHandlers {
  signedUrl?: string | null;
  conversationToken?: string | null;
  clientTools: Record<string, (parameters: Record<string, unknown>) => Promise<string>>;
  onMessage: (message: { source: 'user' | 'ai'; text: string }) => void;
  onStatus: (status: string) => void;
  onMode?: (mode: 'listening' | 'speaking') => void;
  onError: (message: string) => void;
  onDisconnect: () => void;
}

export interface VoiceCallSession {
  endSession: () => Promise<void>;
  getId: () => string;
  setMicMuted: (muted: boolean) => void;
}

export async function startVoiceSession(handlers: VoiceSessionHandlers): Promise<VoiceCallSession> {
  const callbacks = {
    clientTools: handlers.clientTools,
    onMessage: (payload: { source?: 'user' | 'ai'; message?: string }) => {
      if (payload.message) handlers.onMessage({ source: payload.source === 'user' ? 'user' : 'ai', text: payload.message });
    },
    onStatusChange: ({ status }: { status: string }) => handlers.onStatus(status),
    onModeChange: ({ mode }: { mode: 'listening' | 'speaking' }) => handlers.onMode?.(mode),
    onError: (message: string) => handlers.onError(message),
    onDisconnect: () => handlers.onDisconnect(),
  };
  const started = handlers.conversationToken
    ? await Conversation.startSession({ conversationToken: handlers.conversationToken, ...callbacks })
    : handlers.signedUrl
      ? await Conversation.startSession({ signedUrl: handlers.signedUrl, connectionType: 'websocket', ...callbacks })
      : null;
  if (!started) throw new Error('ElevenLabs did not return a voice session.');
  const session = started as VoiceCallSession;
  return {
    endSession: () => session.endSession(),
    getId: () => {
      try {
        return session.getId?.() ?? '';
      } catch {
        return '';
      }
    },
    setMicMuted: (muted: boolean) => session.setMicMuted?.(muted),
  };
}
