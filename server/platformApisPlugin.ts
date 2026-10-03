import type { Plugin } from 'vite';
import { handlePlatformApiAction, keyForTest } from './platformApiStore';

async function testElevenLabs(key: string): Promise<{ ok: boolean; message: string }> {
  const response = await fetch('https://api.elevenlabs.io/v1/user', {
    headers: { 'xi-api-key': key },
  });
  if (response.ok) return { ok: true, message: 'ElevenLabs accepted this API key.' };
  return { ok: false, message: 'ElevenLabs rejected this API key.' };
}

export function platformApisPlugin(): Plugin {
  return {
    name: 'platform-apis',
    configureServer(server) {
      server.middlewares.use('/api/platform-apis', (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') {
          send(405, { ok: false, error: 'Use POST.' });
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        req.on('end', async () => {
          let body: Record<string, unknown> = {};
          const raw = Buffer.concat(chunks).toString('utf8');
          if (raw) {
            try {
              body = JSON.parse(raw) as Record<string, unknown>;
            } catch {
              send(400, { ok: false, error: 'Expected a JSON body.' });
              return;
            }
          }
          if (String(body.action ?? '') === 'test') {
            const { secretName, key } = keyForTest(body);
            if (secretName !== 'ELEVENLABS_API_KEY') {
              send(200, { ok: true, message: 'Saved. This API does not have an automatic connection test.' });
              return;
            }
            if (!key) {
              send(400, { ok: false, error: 'Enter the ElevenLabs API key first.' });
              return;
            }
            try {
              const result = await testElevenLabs(key);
              send(result.ok ? 200 : 400, { ok: result.ok, message: result.message, error: result.ok ? undefined : result.message });
            } catch {
              send(502, { ok: false, error: 'Could not reach ElevenLabs.' });
            }
            return;
          }
          const result = handlePlatformApiAction(body);
          send(result.status, result.payload);
        });
      });
    },
  };
}
