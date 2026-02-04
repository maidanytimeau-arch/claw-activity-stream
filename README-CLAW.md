# Claw Activity Stream Bot

Discord bot that receives OpenClaw activity events and streams them to a dedicated channel with clean, color-coded formatting.

## Quick Start

### 1. Start the Discord Bot

```bash
cd ~/.openclaw/workspace/claw-activity-stream
npm start
```

The bot will log in to Discord and start listening for webhook events.

### 2. Start the Log Parser (in a new terminal)

```bash
cd ~/.openclaw/workspace/claw-activity-stream
npm run parser-dev
```

Or run with PM2:
```bash
pm2 start "npm run parser-dev" --name claw-activity-parser
```

### 3. Monitor Activity

Activity will now stream to your Discord channel (`<#1468398003965526069>`).

---

## Architecture

```
OpenClaw Gateway Logs (~/.openclaw/logs/gateway.err.log)
         ↓
    tail -f (log watcher)
         ↓
    Parser (parser-claw.js)
         ↓
    Webhook POST → http://localhost:3000/webhook/activity
         ↓
    Discord Bot (src/index.js)
         ↓
    Discord Channel Activity Feed
```

---

## Event Types

| Type | Icon | Color | Description |
|------|------|-------|-------------|
| `tool_call` | 🔧 | Blue | Tool execution calls |
| `process` | ⚙️ | Green | Process updates (Discord events, agent activity, etc.) |
| `error` | ❌ | Red | Errors (tool failures, lane errors) |
| `info` | ℹ️ | Gray | Info messages (session memory hooks) |

---

## Commands

### Discord Slash Commands

- `/status` - Show bot status and uptime
- `/toggle-stream` - Pause/resume activity streaming (admin only)

### PM2 Management

```bash
# Start both services
pm2 start npm --name claw-activity-stream -- start
pm2 start npm --name claw-activity-parser -- run parser-dev

# Check status
pm2 status

# View logs
pm2 logs claw-activity-stream
pm2 logs claw-activity-parser

# Restart
pm2 restart claw-activity-stream
pm2 restart claw-activity-parser

# Stop
pm2 stop claw-activity-stream claw-activity-parser

# Remove
pm2 delete claw-activity-stream claw-activity-parser
```

---

## Configuration

Environment variables (see `.env`):

| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `ACTIVITY_CHANNEL_ID` | Channel ID for activity feed |
| `WEBHOOK_SECRET` | Secret for webhook authentication |
| `PORT` | Webhook server port (default: 3000) |
| `ADMIN_USER_ID` | User ID allowed to toggle streaming |

---

## Parser Log Patterns

The parser watches for these patterns in OpenClaw logs:

- `DiscordMessageListener` - Discord message activity
- `[tools]` - Tool calls and failures
- `agent.wait` - Agent wait times
- `[session-memory]` - Session memory hooks
- `gateway tool: restart` - Gateway restarts
- `Slow listener detected` - Performance warnings
- `lane task error` - Lane task failures

Add new patterns in `parser-claw.js` under `PATTERNS`.

---

## Testing

### Test the Bot

```bash
curl -X POST http://localhost:3000/webhook/activity \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: claw-secret-key-change-in-production-2024" \
  -d '{
    "type": "tool_call",
    "tool": "test_tool",
    "result": {"status": "success"},
    "timestamp": "2024-01-01T00:00:00.000Z"
  }'
```

### Test the Parser

```bash
# Manually trigger a log line (for testing)
echo "2024-01-01T00:00:00.000Z [tools] exec failed: test error" >> ~/.openclaw/logs/gateway.err.log
```

---

## Troubleshooting

### No activity appearing?

1. Check bot logs: `pm2 logs claw-activity-stream`
2. Check parser logs: `pm2 logs claw-activity-parser`
3. Verify Discord bot is connected: Check console for "Successfully accessed channel"
4. Check activity channel permissions: Bot needs `Send Messages` and `Embed Links`

### Parser not reading logs?

```bash
# Check log file exists
ls -la ~/.openclaw/logs/gateway.err.log

# Test tail manually
tail -f ~/.openclaw/logs/gateway.err.log
```

### Webhook errors?

Check that `WEBHOOK_SECRET` matches in both `.env` and the parser.

---

## Credits

Built for OpenClaw activity streaming.
