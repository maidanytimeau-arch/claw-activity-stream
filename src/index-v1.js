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
});

// Webhook endpoint for receiving activity events
app.post('/webhook/activity', (req, res) => {
  // Verify webhook secret if configured
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!streamEnabled) {
    return res.json({ status: 'ok', message: 'Stream disabled' });
  }

  const event = req.body;
  sendActivityToDiscord(event);

  res.json({ status: 'ok' });
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
      return;
    }

    const embed = createActivityEmbed(event);
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Error sending activity to Discord:', error.message);
  }
}

// Create Discord embed from activity event
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
    .setTitle(`${icon} ${type.replace(/_/g, ' ').toUpperCase()}`)
    .setTimestamp(event.timestamp || new Date());

  // Add tool info
  if (event.tool) {
    embed.addFields({ name: 'Tool', value: `\`${event.tool}\``, inline: true });
  }

  // Add args (truncate if too long)
  if (event.args) {
    const argsStr = typeof event.args === 'string' ? event.args : JSON.stringify(event.args, null, 2);
    const truncated = argsStr.length > 1000 ? argsStr.substring(0, 1000) + '...' : argsStr;
    embed.addFields({ name: 'Arguments', value: `\`\`\`json\n${truncated}\n\`\`\``, inline: false });
  }

  // Add result (truncate if too long)
  if (event.result) {
    const resultStr = typeof event.result === 'string' ? event.result : JSON.stringify(event.result, null, 2);
    const truncated = resultStr.length > 1000 ? resultStr.substring(0, 1000) + '...' : resultStr;
    embed.addFields({ name: 'Result', value: `\`\`\`json\n${truncated}\n\`\`\``, inline: false });
  }

  // Add reasoning
  if (event.reasoning) {
    const truncated = event.reasoning.length > 2000 ? event.reasoning.substring(0, 2000) + '...' : event.reasoning;
    embed.addFields({ name: 'Reasoning', value: truncated, inline: false });
  }

  // Add error
  if (event.error) {
    embed.addFields({ name: 'Error', value: `\`\`\`\n${event.error}\n\`\`\``, inline: false });
  }

  // Add metadata
  if (event.metadata) {
    embed.addFields({ name: 'Metadata', value: JSON.stringify(event.metadata), inline: true });
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
          .addFields(
            { name: 'Status', value: streamEnabled ? '🟢 Online (Streaming)' : '🟡 Online (Paused)', inline: true },
            { name: 'Uptime', value: uptimeStr, inline: true },
            { name: 'Channel', value: `<#${ACTIVITY_CHANNEL_ID}>`, inline: true },
            { name: 'Started', value: `<t:${Math.floor(startTime.getTime() / 1000)}:R>`, inline: true },
          )
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
