'use strict';

const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const { checkVoice, replyError } = require('../../music/guards');

const LABELS = { off: 'Loop is **off**.', track: 'Looping the **current song**.', queue: 'Looping the **whole queue**.' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Switch loop mode: off, current song, or whole queue.')
    .setDMPermission(false),

  async execute(interaction, client) {
    const check = checkVoice(interaction, client);
    if (check.error) return replyError(interaction, check.error);

    const mode = check.manager.cycleLoop(interaction.guildId);
    return interaction.reply({ embeds: [embeds.success(LABELS[mode])] });
  },
};
