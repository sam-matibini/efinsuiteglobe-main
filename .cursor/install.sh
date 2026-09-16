#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for the efinsuite Globe frontend.
# Safe to run repeatedly: it only installs what is missing and regenerates
# derived state (dependencies, .env, Playwright browser).
set -euo pipefail

cd "$(dirname "$0")/.."

# ---------------------------------------------------------------------------
# 1. Bun (the package manager this repo pins via bun.lock and `bunx` scripts).
# ---------------------------------------------------------------------------
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun >/dev/null 2>&1; then
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
fi

# Make bun/bunx available in every future shell and terminal without relying
# on shell-profile mutation (best-effort; needs sudo which Cloud Agents have).
if command -v sudo >/dev/null 2>&1; then
  sudo ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bun 2>/dev/null || true
  sudo ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bunx 2>/dev/null || true
fi

echo "Using bun $(bun --version)"

# ---------------------------------------------------------------------------
# 2. JavaScript dependencies (frozen to the committed lockfile).
# ---------------------------------------------------------------------------
bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# 3. Frontend environment variables.
#
# These are Supabase *client-side* values (project URL + publishable/anon key)
# that ship in the browser bundle and are already public in the repo. They live
# in a gitignored .env, so a fresh checkout needs them recreated. Any value can
# be overridden by exporting the matching variable before install runs.
# ---------------------------------------------------------------------------
if [ ! -f .env ]; then
  echo "Creating .env with public Supabase client config..."
  cat > .env <<EOF
SUPABASE_URL="${SUPABASE_URL:-https://boskmqywofwekszhgryb.supabase.co}"
SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-sb_publishable_hSUKBXoeM-P6dyfyso1Qqw_j1625N7r}"
VITE_SUPABASE_PROJECT_ID="${VITE_SUPABASE_PROJECT_ID:-boskmqywofwekszhgryb}"
VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvc2ttcXl3b2Z3ZWtzemhncnliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQ5NDYsImV4cCI6MjA5ODQzMDk0Nn0.6wATXwVNUsIPvNyqllvZAQWXQMTlLXGCSQIzi-jmlaE}"
VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-https://boskmqywofwekszhgryb.supabase.co}"
EOF
else
  echo ".env already present; leaving it untouched."
fi

# ---------------------------------------------------------------------------
# 4. Playwright browser for the e2e suite (`bun run test:e2e`).
#    The Chromium binary needs no root; system libraries are installed
#    best-effort so the step never blocks dependency setup.
# ---------------------------------------------------------------------------
if command -v sudo >/dev/null 2>&1; then
  bunx playwright install --with-deps chromium || bunx playwright install chromium || true
else
  bunx playwright install chromium || true
fi

echo "Install complete."
