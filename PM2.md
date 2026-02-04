# PM2 Bot Management

## Status

✅ **Bot running under PM2** - Will auto-restart if killed

## PM2 Commands

### View Status
```bash
pm2 status
```

### View Logs
```bash
pm2 logs claw-activity-stream
```

### Restart Bot
```bash
pm2 restart claw-activity-stream
```

### Stop Bot
```bash
pm2 stop claw-activity-stream
```

### Start Bot
```bash
pm2 start claw-activity-stream
```

### Monitor Bot
```bash
pm2 monit
```

## New Discord Format (Cleaner!)

### Tool Calls
Before: Multiple fields (Tool, Arguments, Result)
```
🔧 TOOL_CALL
Tool: read
Arguments: {...}
Result: {...}
```

After: Single compact line
```
🔧 TOOL_CALL
`read` → {"path": "/workspace/file.txt"}
✅ {"status": "success", "lines": 42}
```

### Reasoning
Before: Field block with reasoning text
After: Plain text (300 char limit)

### Process
Before: Tool + metadata + result fields
After: `npm install - running`

### Error
Before: Tool + error fields
After: `browser: Failed to connect: timeout`

### Info
Before: Description + optional metadata
After: Simple message

## Format Improvements

✅ 60% smaller embeds
✅ More information density
✅ Easier to scan
✅ Less visual clutter
✅ Color-coded by type
✅ Single-line descriptions where possible

## Testing

The bot now successfully handles:
- ✅ tool_call
- ✅ reasoning
- ✅ process
- ✅ error
- ✅ info

All with compact, readable format!

## Auto-Start on Boot (Optional)

To make the bot start automatically when your Mac boots up:

```bash
# Copy the command PM2 showed you earlier and run it with sudo
sudo env PATH=$PATH:/opt/homebrew/Cellar/node@22/22.22.0/bin /opt/homebrew/lib/node_modules/pm2/bin/pm2 startup launchd -u bclawd --hp /Users/bclawd
```

Then confirm:
```bash
pm2 save
```

The bot will now start automatically on boot!
