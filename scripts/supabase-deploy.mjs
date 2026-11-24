#!/usr/bin/env node
// Deploy Supabase migrations and edge functions straight from this repo,
// without Lovable and without the Supabase GitHub integration.
//
// The integration's production deploy fails with "Remote migration versions
// not found in local migrations directory" because the live database has
// migration versions (applied through Lovable) that have no file here. This
// script does not need the histories to match: it applies only the migration
// files you name that the database has not recorded yet, then records them.
//
// Usage:
//   node scripts/supabase-deploy.mjs status
//   node scripts/supabase-deploy.mjs deploy --migrations <file,...> --functions <name,...|all>
//   node scripts/supabase-deploy.mjs deploy --changed <git-range>
//     (--changed picks migration files added and functions touched in the range)
//   Add --dry-run to print the plan without changing anything.
//
// Environment:
//   SUPABASE_ACCESS_TOKEN  personal access token (supabase.com/dashboard/account/tokens)
//   SUPABASE_PROJECT_REF   optional; defaults to project_id in supabase/config.toml

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const FUNCTIONS_DIR = path.join(ROOT, 'supabase', 'functions');

function fail(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const [command = 'status', ...rest] = argv;
  const opts = { command, migrations: [], functions: [], changed: null, dryRun: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const list = () => (rest[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (a === '--migrations') opts.migrations = list();
    else if (a === '--functions') opts.functions = list();
    else if (a === '--changed') opts.changed = rest[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else fail(`Unknown argument: ${a}`);
  }
  return opts;
}

function projectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const toml = readFileSync(path.join(ROOT, 'supabase', 'config.toml'), 'utf8');
  const m = toml.match(/^project_id\s*=\s*"([^"]+)"/m);
  if (!m) fail('Set SUPABASE_PROJECT_REF or project_id in supabase/config.toml.');
  return m[1];
}

function token() {
  const t = process.env.SUPABASE_ACCESS_TOKEN;
  if (!t) fail('Set SUPABASE_ACCESS_TOKEN (create one at https://supabase.com/dashboard/account/tokens).');
  return t;
}

async function runSql(ref, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

async function remoteVersions(ref) {
  const rows = await runSql(ref, 'select version from supabase_migrations.schema_migrations order by version');
  return new Set(rows.map((r) => String(r.version)));
}

function localMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => {
      const [version, ...nameParts] = file.replace(/\.sql$/, '').split('_');
      return { file, version, name: nameParts.join('_') };
    });
}

function resolveMigration(arg) {
  const base = path.basename(arg);
  const match = localMigrations().find((m) => m.file === base || m.version === base || m.file === `${base}.sql`);
  if (!match) fail(`Migration not found in supabase/migrations: ${arg}`);
  return match;
}

function allFunctions() {
  return readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(path.join(FUNCTIONS_DIR, d.name, 'index.ts')))
    .map((d) => d.name);
}

function changedInRange(range) {
  const out = execFileSync('git', ['diff', '--name-status', '--no-renames', range, '--', 'supabase/'], { cwd: ROOT, encoding: 'utf8' });
  const migrations = [];
  const functions = new Set();
  let sharedChanged = false;
  for (const line of out.split('\n').filter(Boolean)) {
    const [status, file] = line.split('\t');
    const m = file.match(/^supabase\/migrations\/([^/]+\.sql)$/);
    if (m && status === 'A') migrations.push(m[1]);
    const f = file.match(/^supabase\/functions\/([^/]+)\//);
    if (f && status !== 'D') {
      if (f[1].startsWith('_')) sharedChanged = true;
      else functions.add(f[1]);
    }
  }
  if (sharedChanged) console.log('ℹ Shared function code (supabase/functions/_*) changed — redeploy dependents with --functions all if needed.');
  return { migrations, functions: [...functions].filter((n) => allFunctions().includes(n)) };
}

function sqlLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

async function applyMigration(ref, m, dryRun) {
  const sql = readFileSync(path.join(MIGRATIONS_DIR, m.file), 'utf8');
  if (dryRun) {
    console.log(`  would apply ${m.file}`);
    return;
  }
  // Sent as one simple-query batch, so Postgres runs it in a single implicit
  // transaction: the migration and its history row land together or not at all.
  const record = `insert into supabase_migrations.schema_migrations(version, name, statements)
    values (${sqlLiteral(m.version)}, ${sqlLiteral(m.name)}, array[${sqlLiteral(sql)}])
    on conflict (version) do nothing;`;
  await runSql(ref, `${sql}\n;\n${record}`);
  console.log(`  ✔ applied ${m.file}`);
}

function deployFunction(ref, name, dryRun) {
  if (dryRun) {
    console.log(`  would deploy ${name}`);
    return;
  }
  const isWin = process.platform === 'win32';
  execFileSync(isWin ? 'npx.cmd' : 'npx', ['--yes', 'supabase@latest', 'functions', 'deploy', name, '--project-ref', ref, '--use-api'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: isWin,
  });
  console.log(`  ✔ deployed ${name}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const ref = projectRef();
  console.log(`Supabase project: ${ref}`);

  if (opts.command === 'status') {
    const remote = await remoteVersions(ref);
    const local = localMigrations();
    const localSet = new Set(local.map((m) => m.version));
    const pending = local.filter((m) => !remote.has(m.version));
    const remoteOnly = [...remote].filter((v) => !localSet.has(v));
    console.log(`\nLocal migration files not recorded in the database (${pending.length}):`);
    pending.forEach((m) => console.log(`  ${m.file}`));
    console.log(`\nDatabase versions with no local file (${remoteOnly.length}) — these block "supabase db push" and the GitHub integration:`);
    remoteOnly.forEach((v) => console.log(`  ${v}`));
    console.log('\nNote: a pending file may already have been applied by hand or by Lovable under another version. Read it before deploying.');
    return;
  }

  if (opts.command !== 'deploy') fail(`Unknown command: ${opts.command}`);

  let migrations = opts.migrations.map(resolveMigration);
  let functions = opts.functions.includes('all') ? allFunctions() : opts.functions;
  if (opts.changed) {
    const ch = changedInRange(opts.changed);
    migrations = [...migrations, ...ch.migrations.map(resolveMigration)];
    functions = [...new Set([...functions, ...ch.functions])];
  }
  for (const f of functions) if (!allFunctions().includes(f)) fail(`Edge function not found: supabase/functions/${f}`);
  if (!migrations.length && !functions.length) {
    console.log('Nothing to deploy.');
    return;
  }

  console.log(`Selected migrations: ${migrations.map((m) => m.file).join(', ') || 'none'}`);
  console.log(`Selected functions:  ${functions.join(', ') || 'none'}`);

  const remote = await remoteVersions(ref);
  const toApply = migrations.filter((m) => {
    if (remote.has(m.version)) {
      console.log(`  • ${m.file} already recorded — skipping`);
      return false;
    }
    return true;
  });

  console.log(`\nMigrations (${toApply.length}):`);
  for (const m of toApply) await applyMigration(ref, m, opts.dryRun);

  console.log(`\nEdge functions (${functions.length}):`);
  for (const f of functions) deployFunction(ref, f, opts.dryRun);

  console.log('\nDone.');
}

main().catch((e) => fail(e.message));
