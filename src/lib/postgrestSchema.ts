/** PostgREST / Postgres errors when the hosted schema is behind the app. */

export function missingColumnFromError(
  error: { message?: string; code?: string } | null | undefined,
): string | null {
  if (!error) return null;
  const msg = error.message || '';
  const code = error.code || '';
  const looksLikeMissing =
    code === 'PGRST204' ||
    code === '42703' ||
    /schema cache/i.test(msg) ||
    /does not exist/i.test(msg) ||
    /could not find the '/i.test(msg);
  if (!looksLikeMissing) return null;
  const fromCache = msg.match(/Could not find the '([^']+)' column/i);
  if (fromCache) return fromCache[1];
  const fromPg = msg.match(/column (?:\w+\.)?["']?(\w+)["']? does not exist/i);
  if (fromPg) return fromPg[1];
  return null;
}
