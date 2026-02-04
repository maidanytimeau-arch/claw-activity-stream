#!/bin/bash

# Example: Send test events to the activity stream bot

BASE_URL="http://localhost:3000"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-}"

# Helper function to send events
send_event() {
  local type=$1
  local data=$2

  curl -X POST "$BASE_URL/webhook/activity" \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: $WEBHOOK_SECRET" \
    -d "$data"

  echo ""
}

echo "=== Testing Claw Activity Stream ==="
echo ""

# Test 1: Tool call
echo "1. Sending tool_call event..."
send_event "tool_call" '{
  "type": "tool_call",
  "tool": "read",
  "args": { "path": "/opt/homebrew/lib/node_modules/openclaw/docs" },
  "result": { "status": "success", "lines": 100 },
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
}'
echo ""

# Test 2: Reasoning
echo "2. Sending reasoning event..."
send_event "reasoning" '{
  "type": "reasoning",
  "reasoning": "I need to check the user'\''s calendar for upcoming meetings in the next 24 hours. First, I'\''ll search for relevant memory entries, then fetch calendar data.",
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
}'
echo ""

# Test 3: Process
echo "3. Sending process event..."
send_event "process" '{
  "type": "process",
  "tool": "exec",
  "args": ["npm", "install"],
  "metadata": { "cwd": "/workspace", "background": true },
  "result": { "sessionId": "abc-123", "status": "running" },
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
}'
echo ""

# Test 4: Error
echo "4. Sending error event..."
send_event "error" '{
  "type": "error",
  "tool": "browser",
  "error": "Failed to connect to browser: Timeout after 30s",
  "args": { "action": "open", "targetUrl": "https://example.com" },
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
}'
echo ""

# Test 5: Info
echo "5. Sending info event..."
send_event "info" '{
  "type": "info",
  "message": "New session started via /reset command",
  "metadata": { "model": "chutesai/moonshotai/Kimi-K2.5-TEE", "channel": "discord" },
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
}'
echo ""

echo "=== Done! Check your Discord channel. ==="
