'use strict';

const { MessageFlags } = require('discord.js');
const embeds = require('../utils/embeds');
const { buildPanel } = require('./panel');
const { checkVoice } = require('./guards');

const PREFIX = 'musico:';

/** Handles clicks on the player panel buttons. */
async function handleButton(interaction, client) {
  const check = checkVoice(interaction, client);
  if (check.error) {
    return interaction.reply({ embeds: [embeds.error(check.error)], flags: MessageFlags.Ephemeral });
  }

  const { manager, queue } = check;
  const guildId = interaction.guildId;
  const action = interaction.customId.slice(PREFIX.length);

  switch (action) {
    case 'toggle':
      await manager.togglePause(guildId);
      return interaction.update(buildPanel(queue));
    case 'loop':
      manager.cycleLoop(guildId);
      return interaction.update(buildPanel(queue));
    case 'skip':
      await interaction.deferUpdate();
      await manager.skip(guildId);
      return undefined;
    case 'prev': {
      await interaction.deferUpdate();
      const ok = await manager.previous(guildId);
      if (!ok) {
        await interaction.followUp({
          embeds: [embeds.error('There is no previous song.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      return undefined;
    }
    case 'stop':
      await interaction.deferUpdate();
      await manager.stop(guildId);
      return undefined;
    default:
      return interaction.deferUpdate();
  }
}

module.exports = { handleButton, PREFIX };
