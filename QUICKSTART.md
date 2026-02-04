# Quick Start Guide

## 1. Create Discord Bot

1. Go to https://discord.com/developers/applications
2. Click "New Application" → Name it "Claw Activity Stream"
3. Go to "Bot" → Click "Add Bot"
4. Under "TOKEN" section, click "Reset Token" → Copy it
5. Enable these bot privileges:
   - ✅ Message Content Intent
   - ✅ Server Members Intent (optional)
6. Save

## 2. Invite Bot to Your Server

1. Go to "OAuth2" → "URL Generator"
2. Select scopes:
   - ✅ bot
   - ✅ applications.commands
3. Select bot permissions:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Messages/View Channels
4. Copy generated URL, open in browser, invite to your server

## 3. Setup Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in:
   ```env
   DISCORD_BOT_TOKEN=your_bot_token_here
   ACTIVITY_CHANNEL_ID=1468398003965526069
   ```

3. Get your CLIENT_ID and GUILD_ID:
   - CLIENT_ID: In Discord Dev Portal, "General Information" → Application ID
   - GUILD_ID: Right-click your server → Copy Server ID (enable Developer Mode)

4. Add to `.env`:
   ```env
   CLIENT_ID=your_application_id_here
   GUILD_ID=your_server_id_here
   WEBHOOK_SECRET=some_random_secret_string
   ```

## 4. Install & Run

```bash
# Install dependencies
npm install

# Deploy slash commands (run once after changing commands)
node deploy-commands.js

# Start the bot
npm start
```

## 5. Test It

In a new terminal:

```bash
# Make sure you've set WEBHOOK_SECRET in .env
export WEBHOOK_SECRET=your_webhook_secret

# Run the test script
cd test
./example-usage.sh
```

Or send a manual request:

```bash
curl -X POST http://localhost:3000/webhook/activity \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your_webhook_secret" \
  -d '{
    "type": "info",
    "message": "Hello from Claw Activity Stream!",
    "timestamp": "2026-02-04T11:00:00Z"
  }'
```

## 6. Use Slash Commands

In Discord, type:
- `/status` - Check bot status
- `/toggle-stream` - Pause/resume streaming (if you're admin)

## Integration with OpenClaw

To make OpenClaw send events to this bot, you can:

### Option A: Webhook Wrapper (Recommended)
Create a wrapper script that intercepts and forwards tool calls:

```bash
#!/bin/bash
# forward-to-claw-stream.sh

WEBHOOK_URL="http://localhost:3000/webhook/activity"
WEBHOOK_SECRET="your_secret"

send_event() {
  curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: $WEBHOOK_SECRET" \
    -d "$1" > /dev/null
}

# Example: wrap OpenClaw command
# This would need to be adapted to actual OpenClaw architecture
```

### Option B: Direct Integration (Advanced)
If OpenClaw supports middleware or event hooks, configure it to POST to this webhook.

### Option C: Log Monitoring
Set up a file watcher that reads OpenClaw logs and forwards them.

## Troubleshooting

**Bot not responding to commands:**
- Make sure you deployed commands with `node deploy-commands.js`
- Check bot has "Send Messages" permission in the channel

**Events not appearing:**
- Check bot is running and connected to Discord
- Verify ACTIVITY_CHANNEL_ID in .env is correct
- Check bot has "Send Messages" + "Embed Links" permissions in the channel
- Verify webhook secret matches

**"Unauthorized" error:**
- Check x-webhook-secret header matches WEBHOOK_SECRET in .env

## Next Steps

- Set up systemd service or PM2 for auto-restart
- Configure OpenClaw to send events
- Customize embed colors/icons in `src/index.js`
- Add rate limiting for high-volume activity
