#!/usr/bin/env bash
# Local dev server on dedicated ports (4000/4001) to avoid conflicts with agent tests.
#
# Usage:
#   npm run local                          # Uses default test session
#   npm run local -- ./path/to/file.jsonl  # Use a specific session file
#
# Express API:  http://localhost:4000
# Vite UI:      http://localhost:4001  <-- open this in your browser

set -e

LOCAL_SERVER_PORT=4000
LOCAL_VITE_PORT=4001

# Default to the largest/most interesting test session
DEFAULT_FILE="testdata/-Users-anhad-Projects-claude-tracer/f1cf0635-ee0f-4598-b5f5-1b9d05802a9c.jsonl"
SESSION_FILE="${1:-$DEFAULT_FILE}"

cleanup() {
  kill $(jobs -p) 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

echo ""
echo "  claude-tracer local dev"
echo "  ======================="
echo "  UI:      http://localhost:${LOCAL_VITE_PORT}"
echo "  API:     http://localhost:${LOCAL_SERVER_PORT}"
echo "  Session: ${SESSION_FILE}"
echo ""

# Start Express server on port 4000
npx tsx watch src/server/index.ts --file "$SESSION_FILE" --port "$LOCAL_SERVER_PORT" &
SERVER_PID=$!

# Start Vite dev server on port 4001, with proxy pointing to port 4000
VITE_BACKEND_PORT=$LOCAL_SERVER_PORT npx vite --port "$LOCAL_VITE_PORT" &
VITE_PID=$!

# Wait for either process to exit
wait -n $VITE_PID $SERVER_PID 2>/dev/null || true

cleanup
