'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embeds = require('../../utils/embeds');
const { buildEmbed } = require('../../music/panel');

module.exports = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show the song that is playing now.').setDMPermission(false),

  async execute(interaction, client) {
    const queue = client.music?.getQueue(interaction.guildId);
    if (!queue?.isActive) {
      return interaction.reply({ embeds: [embeds.error('Nothing is playing right now.')], flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({ embeds: [buildEmbed(queue)], flags: MessageFlags.Ephemeral });
  },
};
