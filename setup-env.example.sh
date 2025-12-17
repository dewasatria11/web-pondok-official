#!/usr/bin/env bash
set -euo pipefail

# Load environment variables from `.env` (copy from `.env.example` first).
# This script is safe to commit because it contains NO secrets.

if [[ ! -f ".env" ]]; then
  echo "Missing .env. Run: cp .env.example .env (then fill values)"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ".env"
set +a

required=(SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY)
missing=()
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    missing+=("$key")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Missing env vars: ${missing[*]}"
  exit 1
fi

echo "Loaded env vars from .env: ${required[*]}"
