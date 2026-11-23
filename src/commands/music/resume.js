'use strict';

const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const { checkVoice, replyError } = require('../../music/guards');

module.exports = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Resume the music.').setDMPermission(false),

  async execute(interaction, client) {
    const check = checkVoice(interaction, client);
    if (check.error) return replyError(interaction, check.error);
    if (!check.queue.paused) return replyError(interaction, 'The music is not paused.');

    await check.manager.setPaused(interaction.guildId, false);
    return interaction.reply({ embeds: [embeds.success('Resumed.')] });
  },
};
