'use strict';

const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const { checkVoice, replyError } = require('../../music/guards');

module.exports = {
  aliases: ['b'],
  data: new SlashCommandBuilder().setName('previous').setDescription('Go back to the previous song.').setDMPermission(false),

  async execute(interaction, client) {
    const check = checkVoice(interaction, client);
    if (check.error) return replyError(interaction, check.error);

    const ok = await check.manager.previous(interaction.guildId);
    if (!ok) return replyError(interaction, 'There is no previous song.');
    return interaction.reply({ embeds: [embeds.success('Playing the previous song.')] });
  },
};
