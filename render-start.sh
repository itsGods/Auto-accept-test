#!/bin/sh
set -e

echo "Applying database schema..."
pnpm --filter @workspace/db run push-force

echo "Starting server..."
exec node artifacts/api-server/dist/index.mjs
