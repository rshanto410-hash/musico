'use strict';

const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const { checkVoice, replyError } = require('../../music/guards');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the music, clear the queue and leave the voice channel.')
    .setDMPermission(false),

  async execute(interaction, client) {
    const check = checkVoice(interaction, client);
    if (check.error) return replyError(interaction, check.error);

    await check.manager.stop(interaction.guildId);
    return interaction.reply({ embeds: [embeds.success('Stopped the music and left the voice channel.')] });
  },
};
