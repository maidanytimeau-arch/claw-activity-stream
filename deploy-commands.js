#!/usr/bin/env node

import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const commands = [
  {
    name: 'status',
    description: 'Check bot status and uptime',
  },
  {
    name: 'toggle-stream',
    description: 'Toggle activity streaming on/off (admin only)',
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('🔄 Started refreshing application (/) commands.');

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
