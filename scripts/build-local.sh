#!/usr/bin/env bash
set -euo pipefail

# Use Node 20 if available via nvm (ignore errors if nvm not present)
if command -v nvm >/dev/null 2>&1; then
  nvm use 20 || true
fi

npm ci
npm run build
npm run export

echo "✅ Build complete. Output folder: ./out"


