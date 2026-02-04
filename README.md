# Claw Activity Stream

A Discord bot that streams OpenClaw agent activity (tool calls, reasoning, backend processes) in real-time.

## Features

- 📡 Real-time activity streaming to Discord
- 🔧 Tool call visibility
- 🧠 Reasoning/thinking logs
- ⚙️ Backend process monitoring
- 🎨 Rich embeds with timestamps and metadata

## Setup

1. Clone this repository
2. Create a Discord application and bot at https://discord.com/developers/applications
3. Copy your bot token to `.env`:
   ```
   DISCORD_BOT_TOKEN=your_bot_token_here
   ACTIVITY_CHANNEL_ID=1468398003965526069
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the service:
   ```bash
   npm start
   ```

## Usage

### Sending Activity to the Bot

The bot exposes a webhook endpoint at `POST /webhook/activity`. Send activity events like this:

```bash
curl -X POST http://localhost:3000/webhook/activity \
  -H "Content-Type: application/json" \
  -d '{
    "type": "tool_call",
    "tool": "read",
    "args": { "path": "/path/to/file" },
    "timestamp": "2026-02-04T11:00:00Z"
  }'
```

### Event Types

- `tool_call` - Tool invocation with args
- `reasoning` - Agent thinking/reasoning output
- `process` - Background process status
- `error` - Errors and failures
- `info` - General information

## Discord Commands

- `/status` - Check bot status
- `/toggle-stream` - Enable/disable streaming (admin only)

## Development

```bash
npm run dev    # Start with auto-reload
npm test       # Run tests
npm lint       # Lint code
```

## License

MIT
