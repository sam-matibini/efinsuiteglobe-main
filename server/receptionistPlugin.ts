import fs from 'fs';
import type { Plugin } from 'vite';
import { handleReceptionApi, handleReceptionVoice } from '../src/lib/receptionist/api';
import type { ReceptionOrg } from '../src/lib/receptionist/types';

const storePath = '/tmp/efinsuite-receptionist.json';

function readStore(): Record<string, ReceptionOrg> {
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf8')) as Record<string, ReceptionOrg>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, ReceptionOrg>) {
  fs.writeFileSync(storePath, JSON.stringify(store));
}

export function receptionistPlugin(): Plugin {
  return {
    name: 'ai-receptionist',
    configureServer(server) {
      server.middlewares.use('/api/receptionist', (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
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
          const action = String(body.action ?? 'state');
          const store = readStore();
          const context = {
            apiKey: process.env.ELEVENLABS_API_KEY || '',
            toolBaseUrl: process.env.RECEPTIONIST_TOOL_URL || '',
          };
          const result = handleReceptionApi({ method: req.method || 'POST', action, body }, store, context);
          if ((action === 'sync' || action === 'session') && result.org && context.apiKey) {
            try {
              const voice = await handleReceptionVoice(action, result.org, context);
              if (voice.org !== result.org) {
                store[voice.org.organizationId] = voice.org;
                writeStore(store);
              }
              send(200, voice.body);
            } catch (error) {
              send(502, { ok: false, error: error instanceof Error ? error.message : 'ElevenLabs request failed.' });
            }
            return;
          }
          if (result.org) {
            store[result.org.organizationId] = result.org;
            writeStore(store);
          }
          send(result.status === 202 ? 200 : result.status, result.body);
        });
      });
    },
  };
}
