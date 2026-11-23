'use strict';

const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const { checkVoice, replyError } = require('../../music/guards');

module.exports = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause the music.').setDMPermission(false),

  async execute(interaction, client) {
    const check = checkVoice(interaction, client);
    if (check.error) return replyError(interaction, check.error);
    if (check.queue.paused) return replyError(interaction, 'The music is already paused. Use /resume.');

    await check.manager.setPaused(interaction.guildId, true);
    return interaction.reply({ embeds: [embeds.success('Paused. Use /resume to continue.')] });
  },
};
