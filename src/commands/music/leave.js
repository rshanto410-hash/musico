'use strict';

const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const { replyError } = require('../../music/guards');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Make MUSICO leave the voice channel (also clears the queue).')
    .setDMPermission(false),

  async execute(interaction, client) {
    const voice = interaction.member?.voice?.channel;
    const player = client.shoukaku?.players.get(interaction.guildId);

    if (!player) return replyError(interaction, 'I am not in a voice channel.');
    if (!voice || player.connection?.channelId !== voice.id) {
      return replyError(interaction, 'You need to be in my voice channel to send me away.');
    }

    await client.music.stop(interaction.guildId);
    return interaction.reply({ embeds: [embeds.success('Left the voice channel. See you!')] });
  },
};
