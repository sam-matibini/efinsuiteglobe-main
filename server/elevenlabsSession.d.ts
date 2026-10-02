export function readElevenLabsApiKey(env?: Record<string, string | undefined>): string;

export function createElevenLabsSession(
  apiKey: string,
  surface: string,
  configuredAgentId?: string,
  fetchImpl?: typeof fetch,
): Promise<{ status: number; body: Record<string, unknown> }>;
