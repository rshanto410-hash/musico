'use strict';

const { Events, MessageFlags } = require('discord.js');
const logger = require('../utils/logger');
const embeds = require('../utils/embeds');
const { handleButton, PREFIX } = require('../music/buttons');
const { handleSelection } = require('../music/searchSelection');

module.exports = {
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    // User-confirmed track selection from /play search results.
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('musico:search:')) {
      try { await handleSelection(interaction, client); }
      catch (err) { logger.error('Track selection failed:', err); if (interaction.deferred || interaction.replied) await interaction.followUp({ content: 'Could not select that track. Please run /play again.', flags: MessageFlags.Ephemeral }); else await interaction.reply({ content: 'Could not select that track. Please run /play again.', flags: MessageFlags.Ephemeral }); }
      return;
    }

    // Player panel buttons (pause, skip, stop, ...)
    if (interaction.isButton() && interaction.customId.startsWith(PREFIX)) {
      try {
        await handleButton(interaction, client);
      } catch (err) {
        logger.error('Error in player button:', err);
        const payload = {
          embeds: [embeds.error('That button did not work. Please try again.')],
          flags: MessageFlags.Ephemeral,
        };
        try {
          if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
          else await interaction.reply(payload);
        } catch (replyErr) {
          logger.error('Could not send button error message:', replyErr);
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`Unknown command received: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (err) {
      logger.error(`Error in /${interaction.commandName}:`, err);
      const payload = {
        embeds: [embeds.error('An unexpected error happened. Please try again in a moment.')],
        flags: MessageFlags.Ephemeral,
      };
      try {
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
        else await interaction.reply(payload);
      } catch (replyErr) {
        logger.error('Could not send error message to user:', replyErr);
      }
    }
  },
};
