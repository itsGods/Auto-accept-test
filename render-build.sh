#!/bin/sh
set -e

echo "Installing pnpm locally..."
npm install pnpm@10.26.1 --prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"

echo "Installing dependencies..."
pnpm install --frozen-lockfile

echo "Building admin panel..."
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/admin-panel run build

echo "Building API server..."
pnpm --filter @workspace/api-server run build

echo "Build complete."
