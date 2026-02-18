#!/usr/bin/env bash
# Dev script that starts both the backend server and Vite UI dev server.
# Usage:
#   npm run dev                          # No file watching
#   npm run dev -- ./path/to/file.jsonl  # Watch a session file
#   npm run dev -- --file ./path/to/file.jsonl

set -e

# All arguments after "npm run dev --" are forwarded to the server
SERVER_ARGS="$*"

cleanup() {
  # Kill all background jobs on exit
  kill $(jobs -p) 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

# Start the Vite dev server in the background
npx vite &
VITE_PID=$!

# Start the backend server with tsx watch, forwarding all args
npx tsx watch src/server/index.ts $SERVER_ARGS &
SERVER_PID=$!

# Wait for both processes (compatible with bash 3.2 on macOS)
wait $VITE_PID $SERVER_PID 2>/dev/null || true
