// Enhanced Discord bot with icon-coded formatting (inspired by openclaw-discord-audit)

import { Client, GatewayIntentBits } from 'discord.js';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const app = express();
app.use(express.json());

const ACTIVITY_CHANNEL_ID = process.env.ACTIVITY_CHANNEL_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

let streamEnabled = true;
let startTime = new Date();

// Discord Ready
client.once('ready', () => {
  console.log(`🤖 Claw Activity Stream bot logged in as ${client.user.tag}`);
  console.log(`📡 Streaming to channel: ${ACTIVITY_CHANNEL_ID}`);
  console.log(`⏱️ Started at: ${startTime.toISOString()}`);

  client.channels.fetch(ACTIVITY_CHANNEL_ID)
    .then(channel => {
      console.log(`✅ Successfully accessed channel: ${channel.name || channel.id}`);
    })
    .catch(err => {
      console.error(`❌ Cannot access channel ${ACTIVITY_CHANNEL_ID}:`, err.message);
    });
});

// Webhook endpoint for receiving activity events
app.post('/webhook/activity', async (req, res) => {
  const eventType = req.body.type || 'unknown';
  console.log(`📥 ${req.body.icon || '📡'} ${eventType.toUpperCase()}`);

  // Verify webhook secret
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    console.log('❌ Webhook secret verification failed');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!streamEnabled) {
    console.log('⏸️ Stream disabled, skipping');
    return res.json({ status: 'ok', message: 'Stream disabled' });
  }

  const event = req.body;
  const result = await sendActivityToDiscord(event);
  console.log(`✅ Sent: ${result.status}`);

  res.json(result);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    streamEnabled,
    startTime: startTime.toISOString(),
  });
});

// Send activity to Discord
async function sendActivityToDiscord(event) {
  try {
    const channel = await client.channels.fetch(ACTIVITY_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Activity channel not found');
      return { status: 'error', error: 'Channel not found' };
    }

    // Send as compact message with icon prefix (audit style)
    const message = formatActivityMessage(event);
    const sent = await channel.send(message);

    return { status: 'ok', messageId: sent.id };
  } catch (error) {
    console.error('❌ Error sending activity to Discord:', error.message);
    return { status: 'error', error: error.message, code: error.code };
  }
}

/**
 * Format activity as compact icon-coded message (like openclaw-discord-audit)
 */
function formatActivityMessage(event) {
  const icon = event.icon || '📡';
  const timestamp = event.timestamp ? new Date(event.timestamp).toLocaleTimeString('en-AU', { hour12: false }) : '';

  let message = `${icon}`;

  // Add timestamp if available
  if (timestamp) {
    message += ` \`[${timestamp}]\``;
  }

  // Format by event type
  switch (event.type) {
    case 'thinking':
      message += ` **THINKING**\n${truncate(event.reasoning, 300)}`;
      break;

    case 'tool_call':
      message += ` \`${event.tool}\``;
      if (event.args) {
        const argsStr = typeof event.args === 'string' ? event.args : JSON.stringify(event.args);
        message += ` → ${truncate(argsStr, 150)}`;
      }
      break;

    case 'tool_result':
      message += ` \`${event.tool}\``;
      if (event.success) {
        const resultStr = truncate(String(event.result), 150);
        message += `\n✓ ${resultStr}`;
      } else {
        message += `\n❌ ${truncate(String(event.result), 200)}`;
      }
      break;

    case 'text_output':
      message += ` ${truncate(event.message, 300)}`;
      break;

    case 'user_message':
      message += ` ${truncate(event.message, 200)}`;
      break;

    case 'info':
      message += ` ${event.message}`;
      if (event.metadata) {
        message += `\n${JSON.stringify(event.metadata)}`;
      }
      break;

    case 'process':
      message += ` ${event.message}`;
      if (event.metadata) {
        message += ` (${JSON.stringify(event.metadata)})`;
      }
      break;

    case 'error':
      message += ` **ERROR**: ${event.error || event.message || 'Unknown'}`;
      if (event.metadata?.raw) {
        message += `\n\`${truncate(event.metadata.raw, 150)}\``;
      }
      break;

    default:
      message += ` ${event.message || event.tool || event.type}`;
  }

  return message;
}

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str, maxLen) {
  if (!str) return '';
  const s = String(str);
  return s.length > maxLen ? s.substring(0, maxLen) + '...' : s;
}

// Discord slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'status') {
    const uptime = process.uptime();
    const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

    await interaction.reply({
      content: `📊 **Bot Status**
🟢 Status: ${streamEnabled ? 'Streaming' : 'Paused'}
⏱️ Uptime: ${uptimeStr}
📡 Channel: <#${ACTIVITY_CHANNEL_ID}>
🤖 Bot: ${client.user.tag}`,
    });
  }

  if (commandName === 'toggle-stream') {
    if (ADMIN_USER_ID && interaction.user.id !== ADMIN_USER_ID) {
      await interaction.reply({ content: '❌ Only admins can toggle streaming.', ephemeral: true });
      return;
    }

    streamEnabled = !streamEnabled;
    await interaction.reply({
      content: streamEnabled ? '▶️ **Streaming Enabled**' : '⏸️ **Streaming Disabled**',
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Webhook server listening on port ${PORT}`);
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN);
