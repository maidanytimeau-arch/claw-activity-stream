// Refactored version with cleaner Discord formatting

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
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

  // Check channel access
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
  console.log('📥 Webhook received:', req.body.type || 'unknown');

  // Verify webhook secret if configured
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    console.log('❌ Webhook secret verification failed');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!streamEnabled) {
    console.log('⏸️ Stream disabled, skipping');
    return res.json({ status: 'ok', message: 'Stream disabled' });
  }

  const event = req.body;
  console.log('📤 Sending to Discord:', event.type);
  const result = await sendActivityToDiscord(event);
  console.log('✅ Send result:', result);

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

    const embed = createActivityEmbed(event);
    console.log('📨 Embed created:', {
      type: embed.data.title,
      description: embed.data.description?.substring(0, 50),
      color: embed.data.color,
    });

    const sent = await channel.send({ embeds: [embed] });
    console.log('✅ Message sent successfully:', sent.id);

    return { status: 'ok', messageId: sent.id };
  } catch (error) {
    console.error('❌ Error sending activity to Discord:');
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    console.error('   Stack:', error.stack);
    if (error.rawError) {
      console.error('   Raw error:', JSON.stringify(error.rawError, null, 2));
    }
    return { status: 'error', error: error.message, code: error.code };
  }
}

// Create Discord embed from activity event - CLEANER VERSION
function createActivityEmbed(event) {
  const colors = {
    tool_call: 0x3498db, // Blue
    reasoning: 0x9b59b6, // Purple
    process: 0x1abc9c, // Green
    error: 0xe74c3c, // Red
    info: 0x95a5a6, // Gray
    default: 0x34495e, // Dark blue
  };

  const icons = {
    tool_call: '🔧',
    reasoning: '🧠',
    process: '⚙️',
    error: '❌',
    info: 'ℹ️',
    default: '📡',
  };

  const type = event.type || 'default';
  const color = colors[type] || colors.default;
  const icon = icons[type] || icons.default;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${icon} ${type.replace(/_/g, ' ').toUpperCase()}`);

  // Only set timestamp if it's valid
  if (event.timestamp) {
    const timestamp = new Date(event.timestamp);
    if (!isNaN(timestamp.getTime())) {
      embed.setTimestamp(timestamp);
    }
  } else {
    embed.setTimestamp();
  }

  // Build description instead of multiple fields for cleaner look
  let description = '';

  // Tool call: compact inline format
  if (event.type === 'tool_call' && event.tool) {
    description += `\`${event.tool}\``;

    if (event.args) {
      const argsStr = typeof event.args === 'string' ? event.args : JSON.stringify(event.args);
      const compactArgs = argsStr.length > 200 ? argsStr.substring(0, 200) + '...' : argsStr;
      description += ` → ${compactArgs}`;
    }

    if (event.result) {
      const resultStr = typeof event.result === 'string' ? event.result : JSON.stringify(event.result);
      const compactResult = resultStr.length > 150 ? resultStr.substring(0, 150) + '...' : resultStr;
      description += `\n✅ ${compactResult}`;
    }

    embed.setDescription(description);
  }
  // Reasoning: concise text
  else if (event.type === 'reasoning' && event.reasoning) {
    const truncated = event.reasoning.length > 300 ? event.reasoning.substring(0, 300) + '...' : event.reasoning;
    embed.setDescription(truncated);
  }
  // Process: compact format
  else if (event.type === 'process') {
    if (event.tool) {
      description += `\`${event.tool}\``;
    }
    if (event.result && event.result.status) {
      description += ` - ${event.result.status}`;
    }
    embed.setDescription(description || 'Process update');
  }
  // Error: focused on the error message
  else if (event.type === 'error') {
    if (event.tool) {
      description += `**${event.tool}**: `;
    }
    description += event.error || 'Unknown error';
    embed.setDescription(description);
  }
  // Info: simple message
  else if (event.type === 'info' && event.message) {
    embed.setDescription(event.message);
  }
  // Default: try to show something useful
  else {
    if (event.message) {
      embed.setDescription(event.message);
    } else if (event.tool) {
      embed.setDescription(`Tool: \`${event.tool}\``);
    }
  }

  // Only add metadata field if it exists and is meaningful
  if (event.metadata && Object.keys(event.metadata).length > 0) {
    const metaStr = JSON.stringify(event.metadata);
    const compactMeta = metaStr.length > 150 ? metaStr.substring(0, 150) + '...' : metaStr;
    embed.addFields({ name: 'Meta', value: compactMeta, inline: true });
  }

  return embed;
}

// Discord slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'status') {
    const uptime = process.uptime();
    const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x1abc9c)
          .setTitle('📊 Bot Status')
          .addFields([
            { name: 'Status', value: streamEnabled ? '🟢 Streaming' : '🟡 Paused', inline: true },
            { name: 'Uptime', value: uptimeStr, inline: true },
            { name: 'Channel', value: `<#${ACTIVITY_CHANNEL_ID}>`, inline: true },
          ])
          .setTimestamp(),
      ],
    });
  }

  if (commandName === 'toggle-stream') {
    if (ADMIN_USER_ID && interaction.user.id !== ADMIN_USER_ID) {
      await interaction.reply({ content: '❌ Only admins can toggle streaming.', ephemeral: true });
      return;
    }

    streamEnabled = !streamEnabled;
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(streamEnabled ? 0x1abc9c : 0xf39c12)
          .setTitle(streamEnabled ? '▶️ Streaming Enabled' : '⏸️ Streaming Disabled')
          .setDescription(streamEnabled ? 'Activity will now be streamed to Discord.' : 'Activity streaming is paused.')
          .setTimestamp(),
      ],
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
