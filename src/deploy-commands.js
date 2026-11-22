'use strict';

// Registers slash commands with Discord. Run with: npm run deploy
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');
const { loadCommands } = require('./utils/loader');

async function main() {
  const commands = loadCommands(path.join(__dirname, 'commands'), logger);
  const body = [...commands.values()].map((command) => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.token);

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  logger.info(
    `Registering ${body.length} command(s) ${config.guildId ? `to server ${config.guildId}` : 'globally'}...`
  );
  await rest.put(route, { body });
  logger.info('Slash commands registered successfully.');
}

main().catch((err) => {
  logger.error('Failed to register commands:', err);
  process.exit(1);
});
