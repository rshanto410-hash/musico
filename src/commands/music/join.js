'use strict';

const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const logger = require('../../utils/logger');
const { preparePlayback, replyError } = require('../../music/guards');

module.exports = {
  data: new SlashCommandBuilder().setName('join').setDescription('Make MUSICO join your voice channel.').setDMPermission(false),

  async execute(interaction, client) {
    const voiceChannel = await preparePlayback(interaction, client);
    if (!voiceChannel) return undefined;

    try {
      await client.music.join({ guild: interaction.guild, voiceChannel, textChannel: interaction.channel });
    } catch (err) {
      logger.error('Could not join voice channel:', err);
      return replyError(interaction, 'I could not join the voice channel. Check that I can connect and speak there.');
    }
    return interaction.reply({
      embeds: [embeds.success(`Joined **${voiceChannel.name}**. Use \`/play\` to start a song, or \`/leave\` to send me away.`)],
    });
  },
};
