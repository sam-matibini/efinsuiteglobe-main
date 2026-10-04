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

/** ElevenLabs built-in conversation tools. Phone transfer is included only for numbers already stored in E.164. */
export function elevenSystemTools(org: ReceptionOrg): Array<Record<string, unknown>> {
  const tools: Array<Record<string, unknown>> = [
    { type: 'system', name: 'end_call', description: 'End the call when the caller is done or says goodbye.' },
    { type: 'system', name: 'language_detection', description: 'Switch language when the caller changes language.' },
  ];
  const transfers = [...org.routes.map((route) => route.destinationPhone), org.forwardingNumber]
    .map((phone) => phone.trim())
    .filter((phone, index, all) => phone.startsWith('+') && all.indexOf(phone) === index)
    .map((phone) => ({
      transfer_destination: { type: 'phone', phone_number: phone },
      condition: `The caller asked to be transferred and this number is ${phone}.`,
      transfer_type: 'conference',
    }));
  if (transfers.length > 0) {
    tools.push({
      type: 'system',
      name: 'transfer_to_number',
      description: 'Transfer the caller to a staff phone number from the routing list.',
      params: { system_tool_type: 'transfer_to_number', transfers },
    });
  }
  return tools;
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
          tools: [...tools, ...elevenSystemTools(org)],
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
