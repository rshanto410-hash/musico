'use strict';

const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the music and leave the voice channel.')
    .setDMPermission(false),

  async execute(interaction, client) {
    const shoukaku = client.shoukaku;
    const player = shoukaku?.players.get(interaction.guildId);

    if (!player) {
      return interaction.reply({
        embeds: [embeds.error('Nothing is playing right now.')],
        ephemeral: true,
      });
    }

    await shoukaku.leaveVoiceChannel(interaction.guildId);
    return interaction.reply({ embeds: [embeds.success('Stopped the music and left the voice channel.')] });
  },
};
