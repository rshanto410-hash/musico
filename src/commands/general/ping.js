'use strict';

const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check that MUSICO is alive.'),

  async execute(interaction, client) {
    const embed = embeds
      .info('🎵 MUSICO is online', 'Pong! Everything looks good.')
      .addFields({ name: 'Websocket latency', value: `${Math.round(client.ws.ping)} ms`, inline: true });
    await interaction.reply({ embeds: [embed] });
  },
};
