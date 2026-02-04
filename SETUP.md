# Claw Activity Stream - Setup Complete ✅

## What Was Built

A Discord bot that streams OpenClaw agent activity (tool calls, reasoning, processes) to a dedicated channel.

**Repository:** https://github.com/maidanytimeau-arch/claw-activity-stream

## Project Structure

```
claw-activity-stream/
├── src/
│   └── index.js              # Main bot code (Discord + webhook server)
├── test/
│   └── example-usage.sh      # Test script to send sample events
├── deploy-commands.js        # Deploy Discord slash commands
├── package.json              # Dependencies
├── .env.example              # Environment template
├── .gitignore
├── README.md                 # Project overview
├── QUICKSTART.md             # Step-by-step setup guide
└── SETUP.md                  # This file
```

## Features

✅ Webhook endpoint (`POST /webhook/activity`) to receive events
✅ Rich Discord embeds with timestamps, colors, and icons
✅ Event types: `tool_call`, `reasoning`, `process`, `error`, `info`
✅ Slash commands: `/status`, `/toggle-stream`
✅ Health check endpoint (`GET /health`)
✅ Webhook secret authentication
✅ Admin-only toggle command

## Next Steps (To Complete Setup)

### 1. Create Discord Bot Application

Go to: https://discord.com/developers/applications

1. Click "New Application" → Name: "Claw Activity Stream"
2. Go to "Bot" → "Add Bot"
3. Enable:
   - ✅ **Message Content Intent** (critical!)
   - ✅ Server Members Intent (optional)
4. Copy the **Token** → Save to `.env`

### 2. Invite Bot to Server

1. In Discord Dev Portal → "OAuth2" → "URL Generator"
2. Scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Bot Permissions:
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Messages/View Channels
4. Copy URL → Open in browser → Add to server

### 3. Create `.env` File

```bash
cd /Users/bclawd/.openclaw/workspace/claw-activity-stream
cp .env.example .env
```

Edit `.env`:

```env
# Get from Discord Dev Portal → General Information
DISCORD_BOT_TOKEN=MTI3NT... (paste your bot token here)

# Your activity channel (already set)
ACTIVITY_CHANNEL_ID=1468398003965526069

# Server configuration
PORT=3000
WEBHOOK_SECRET=generate-a-random-secret-here

# Optional - Get these from Discord Dev Portal
CLIENT_ID=123456789012345678  # Application ID from "General Information"
GUILD_ID=123456789012345678  # Your server ID (right-click server → Copy ID)
ADMIN_USER_ID=125865569374175232  # Your Discord user ID
LOG_LEVEL=info
```

### 4. Install & Start

```bash
# Install dependencies
cd /Users/bclawd/.openclaw/workspace/claw-activity-stream
npm install

# Deploy slash commands (one-time setup)
node deploy-commands.js

# Start the bot
npm start
```

### 5. Test It

**Option A: Run the test script**
```bash
cd test
./example-usage.sh
```

**Option B: Send manual test**
```bash
curl -X POST http://localhost:3000/webhook/activity \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your_webhook_secret" \
  -d '{
    "type": "info",
    "message": "Claw Activity Stream is working!",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
  }'
```

You should see rich embeds appear in your Discord channel! 🎉

## Integrating with OpenClaw

This is the tricky part. OpenClaw needs to send events to this bot. Here are your options:

### Option 1: Log Tailing (Quick & Dirty)
```bash
# Tail OpenClaw logs and forward to webhook
tail -f ~/.openclaw/logs/*.log | while read line; do
  curl -s -X POST http://localhost:3000/webhook/activity \
    -H "Content-Type: application/json" \
    -H "x-webhook-secret: YOUR_SECRET" \
    -d "{
      \"type\": \"info\",
      \"message\": \"$line\",
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
    }"
done
```

### Option 2: OpenClaw Plugin (Best, but requires dev)
Create an OpenClaw plugin/skill that intercepts tool calls and forwards them.

### Option 3: Custom Middleware (Recommended)
Create a wrapper script that logs and forwards before/after tool execution.

Let me know which approach you want, and I can build it!

## Troubleshooting

**Bot not joining voice/text channels?**
- Make sure you invited it with correct permissions
- Check it's in the right server

**Slash commands not working?**
- Run `node deploy-commands.js` again
- Make sure CLIENT_ID and GUILD_ID are correct in `.env`

**Events not appearing?**
- Check bot has "Send Messages" + "Embed Links" in the channel
- Verify webhook secret in request matches `.env`
- Check bot logs for errors

**401 Unauthorized?**
- Missing or incorrect `x-webhook-secret` header

## Running as a Service (Optional)

For persistent uptime, use PM2 or systemd:

**PM2:**
```bash
npm install -g pm2
pm2 start src/index.js --name claw-activity-stream
pm2 save
pm2 startup
```

**systemd:**
```bash
sudo nano /etc/systemd/system/claw-activity-stream.service
```

Contents:
```ini
[Unit]
Description=Claw Activity Stream Bot
After=network.target

[Service]
Type=simple
User=bclawd
WorkingDirectory=/Users/bclawd/.openclaw/workspace/claw-activity-stream
ExecStart=/usr/local/bin/node src/index.js
Restart=always
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable claw-activity-stream
sudo systemctl start claw-activity-stream
sudo systemctl status claw-activity-stream
```

## Summary

✅ Discord bot code written
✅ GitHub repo created (needs git push - authentication issue)
✅ Test scripts ready
✅ Documentation complete
✅ Ready to deploy once Discord bot is created

**What you need to do:**
1. Create Discord bot application (5-10 min)
2. Fill in `.env` with bot token
3. Run `npm install && npm start`
4. Test with `./example-usage.sh`
5. Decide on OpenClaw integration approach

Let me know if you hit any issues or want me to help with the OpenClaw integration!
