import fs from 'fs';
import type { Plugin } from 'vite';
import { handleTimeApi } from '../src/lib/timeAttendance/api';
import type { OrgAttendance } from '../src/lib/timeAttendance/types';

const storePath = '/tmp/efinsuite-time-attendance.json';

function readStore(): Record<string, OrgAttendance> {
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf8')) as Record<string, OrgAttendance>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, OrgAttendance>) {
  fs.writeFileSync(storePath, JSON.stringify(store));
}

export function timeAttendancePlugin(): Plugin {
  return {
    name: 'time-attendance',
    configureServer(server) {
      server.middlewares.use('/api/time', (req, res, next) => {
        const raw = req.url || '/';
        const suffix = raw.startsWith('/api/time') ? raw.slice('/api/time'.length) : raw;
        const pathOnly = suffix.split('?')[0] || '/';
        const path = `/api/time${pathOnly === '/' ? '' : pathOnly}`;
        const query = Object.fromEntries(new URL(raw, 'http://localhost').searchParams.entries());
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method === 'GET') {
          const result = handleTimeApi({ method: 'GET', path, query }, readStore());
          send(result.status, result.body);
          return;
        }
        if (req.method !== 'POST' && req.method !== 'PUT') {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        req.on('end', () => {
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
          const result = handleTimeApi({ method: req.method || 'POST', path, body, query }, readStore());
          if (result.store) writeStore(result.store);
          send(result.status, result.body);
        });
      });
    },
  };
}
