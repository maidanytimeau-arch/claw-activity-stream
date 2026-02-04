# Claw Activity Stream Bot

Parses OpenClaw gateway logs and streams activity events to Discord.

## Features

- **Real-time log parsing** - Watches OpenClaw error logs for activity
- **Event detection** - Captures:
  - Discord message events (with duration)
  - Tool calls (success/failure)
  - Agent activity
  - Slow listener warnings
  - Gateway events
- **Rate limiting** - Prevents Discord spam (max 10 posts/minute)
- **Color-coded events** - Different colors for different event types

## Quick Start

### 1. Install Dependencies

```bash
cd ~/.openclaw/workspace/claw-activity-stream
npm install
```

### 2. Configure Discord Webhook

Get your Discord webhook URL:
1. Go to your Discord server settings → Integrations → Webhooks
2. Create a new webhook or copy an existing one
3. Copy the URL

### 3. Set Environment Variables

```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/123/xyz"
export PORT=3000
```

Or create a `.env` file:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123/xyz
PORT=3000
```

### 4. Start the Bot

```bash
npm start
```

The bot will listen on `http://localhost:3000`.

### 5. Start Log Parsing

In a separate terminal:

```bash
npm test
```

Or manually:

```bash
tail -f ~/.openclaw/logs/gateway.err.log | node parser.js
```

## PM2 Setup (Recommended)

### Start Both Services

```bash
# Start the bot server
pm2 start bot.js --name claw-activity-stream

# Start the log parser
pm2 start "tail -f ~/.openclaw/logs/gateway.err.log | node parser.js" \
  --name claw-activity-parser \
  --interpreter none
```

### Check Status

```bash
pm2 status
```

### View Logs

```bash
pm2 logs claw-activity-stream
pm2 logs claw-activity-parser
```

### Restart

```bash
pm2 restart claw-activity-stream
pm2 restart claw-activity-parser
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCORD_WEBHOOK_URL` | Discord webhook URL | (required) |
| `PORT` | Bot server port | `3000` |
| `WEBHOOK_URL` | Parser webhook target | `http://localhost:3000/webhook` |
| `LOG_PATH` | OpenClaw log path | `~/.openclaw/logs/gateway.err.log` |

## Event Types

| Type | Icon | Color | Description |
|------|------|-------|-------------|
| `discord_message` | 💬 | Blurple | Discord message activity |
| `tool_activity` | 🔧/❌ | Green/Red | Tool calls (success/failed) |
| `agent_activity` | 🤖 | Yellow | Agent wait times |
| `session_activity` | 💾 | Cyan | Session memory hooks |
| `gateway_activity` | 🔄 | Orange | Gateway restarts |
| `slow_listener` | ⚠️ | Yellow | Slow listener warnings |

## Architecture

```
OpenClaw Logs (tail -f)
         ↓
    Parser (parser.js)
         ↓
    Webhook POST
         ↓
    Bot Server (bot.js)
         ↓
    Discord Webhook
```

## Troubleshooting

### No logs appearing?

1. Check log path: `ls -la ~/.openclaw/logs/`
2. Verify tail is running: `pm2 logs claw-activity-parser`
3. Check parser output: Look for JSON output in parser logs

### Not posting to Discord?

1. Verify webhook URL is correct
2. Check bot logs: `pm2 logs claw-activity-stream`
3. Test webhook manually:
   ```bash
   curl -X POST http://localhost:3000/webhook \
     -H "Content-Type: application/json" \
     -d '{"type":"test","data":{"raw":"test message"}}'
   ```

### Rate limiting?

The bot is limited to 10 posts per minute to prevent Discord spam. Events are queued and processed when rate limit resets.

## Development

### Parser Standalone

The parser can output JSON directly without the bot:

```bash
tail -f ~/.openclaw/logs/gateway.err.log | node parser.js
```

This outputs activity events as JSON, which you can pipe to other tools.

### Custom Event Parsing

Edit `PATTERNS` in `parser.js` to add or modify event detection.

## License

MIT
