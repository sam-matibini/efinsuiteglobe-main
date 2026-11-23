import { buildAgentPrompt, clientToolDefinitions } from './engine';
import type { ReceptionOrg } from './types';

export interface ElevenLabsClient {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface VoiceCredentials {
  agentId: string;
  signedUrl: string | null;
  conversationToken: string | null;
}

function headers(apiKey: string): HeadersInit {
  return { 'xi-api-key': apiKey, 'Content-Type': 'application/json' };
}

export function agentRequestBody(org: ReceptionOrg, toolBaseUrl?: string) {
  const tools = clientToolDefinitions().map((tool) => {
    if (!toolBaseUrl) return tool;
    return {
      type: 'webhook',
      name: tool.name,
      description: tool.description,
      api_schema: {
        url: toolBaseUrl,
        method: 'POST',
        request_headers: { 'x-receptionist-secret': org.toolSecret },
        request_body_schema: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            organizationId: { type: 'string' },
            name: { type: 'string' },
            parameters: tool.parameters,
          },
          required: ['action', 'organizationId', 'name'],
        },
      },
    };
  });
  return {
    name: 'eFinsuite AI Receptionist',
    conversation_config: {
      agent: {
        first_message: org.receptionists.find((item) => item.active)?.greeting
          ?? 'Thank you for calling. How can I help you today?',
        language: org.language,
        prompt: {
          prompt: buildAgentPrompt(org),
          tools,
        },
      },
      tts: { voice_id: org.voiceId },
    },
    platform_settings: {
      auth: { enable_auth: true },
    },
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

export async function syncElevenAgent(org: ReceptionOrg, client: ElevenLabsClient, toolBaseUrl?: string): Promise<string> {
  const fetchImpl = client.fetchImpl ?? fetch;
  const body = JSON.stringify(agentRequestBody(org, toolBaseUrl));
  const existing = org.elevenAgentId;
  const response = await fetchImpl(
    existing
      ? `https://api.elevenlabs.io/v1/convai/agents/${existing}`
      : 'https://api.elevenlabs.io/v1/convai/agents/create',
    { method: existing ? 'PATCH' : 'POST', headers: headers(client.apiKey), body },
  );
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(String(payload.message || payload.detail || 'ElevenLabs could not save the receptionist.'));
  }
  return String(payload.agent_id ?? existing ?? '');
}

export async function voiceCredentials(agentId: string, client: ElevenLabsClient): Promise<VoiceCredentials> {
  const fetchImpl = client.fetchImpl ?? fetch;
  const signed = await fetchImpl(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: headers(client.apiKey) },
  );
  const signedBody = await readJson(signed);
  const token = await fetchImpl(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
    { headers: headers(client.apiKey) },
  );
  const tokenBody = await readJson(token);
  if (!signed.ok && !token.ok) {
    throw new Error(String(signedBody.message || signedBody.detail || 'ElevenLabs did not return a voice session.'));
  }
  return {
    agentId,
    signedUrl: signed.ok ? String(signedBody.signed_url ?? '') || null : null,
    conversationToken: token.ok ? String(tokenBody.token ?? '') || null : null,
  };
}
