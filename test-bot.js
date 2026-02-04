// Test script to send a simple message without embeds

import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

const ACTIVITY_CHANNEL_ID = process.env.ACTIVITY_CHANNEL_ID;

client.once('ready', async () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(ACTIVITY_CHANNEL_ID);
    console.log(`✅ Found channel: ${channel.name}`);

    // Test 1: Simple text message
    console.log('📝 Test 1: Sending simple text message...');
    await channel.send('🎉 Test 1: Simple text message works!');
    console.log('✅ Test 1 passed!');

    // Test 2: Message with basic embed
    console.log('📝 Test 2: Sending message with basic embed...');
    const { EmbedBuilder } = await import('discord.js');
    const embed = new EmbedBuilder()
      .setTitle('Test Embed')
      .setDescription('This is a test embed')
      .setColor(0x3498db)
      .setTimestamp();
    await channel.send({ embeds: [embed] });
    console.log('✅ Test 2 passed!');

    // Test 3: Message with fields
    console.log('📝 Test 3: Sending embed with fields...');
    const embed2 = new EmbedBuilder()
      .setTitle('🔧 TOOL_CALL')
      .setColor(0x3498db)
      .addFields({ name: 'Tool', value: '`test_tool`', inline: true })
      .addFields({ name: 'Arguments', value: '```json\n{"test": "data"}\n```', inline: false })
      .setTimestamp();
    await channel.send({ embeds: [embed2] });
    console.log('✅ Test 3 passed!');

    console.log('\n🎉 All tests passed! The bot can send messages to this channel.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.rawError) {
      console.error(`   Raw error:`, JSON.stringify(error.rawError, null, 2));
    }
    process.exit(1);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
