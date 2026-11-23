'use strict';

const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const { checkVoice, replyError } = require('../../music/guards');

module.exports = {
  aliases: ['s'],
  data: new SlashCommandBuilder().setName('skip').setDescription('Skip to the next song.').setDMPermission(false),

  async execute(interaction, client) {
    const check = checkVoice(interaction, client);
    if (check.error) return replyError(interaction, check.error);

    const skipped = check.queue.current?.title;
    await check.manager.skip(interaction.guildId);
    return interaction.reply({ embeds: [embeds.success(skipped ? `Skipped **${skipped}**.` : 'Skipped.')] });
  },
};
