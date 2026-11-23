'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embeds = require('../../utils/embeds');
const logger = require('../../utils/logger');
const { preparePlayback } = require('../../music/guards');
const { searchStations } = require('../../music/radio');

const MAX_STATIONS_TO_TRY = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('radio')
    .setDescription('Play a live internet radio station in your voice channel.')
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('language')
        .setDescription('Which kind of music do you want?')
        .addChoices(
          { name: 'Bangla', value: 'bangla' },
          { name: 'Hindi', value: 'hindi' },
          { name: 'English', value: 'english' },
          { name: 'Any / mixed', value: 'any' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('search')
        .setDescription('Optional station name to look for, for example "lofi".')
        .setMaxLength(50)
    ),

  async execute(interaction, client) {
    const voiceChannel = await preparePlayback(interaction, client);
    if (!voiceChannel) return undefined;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const language = interaction.options.getString('language') || 'any';
    const search = interaction.options.getString('search') || '';

    let stations;
    try {
      stations = await searchStations({ language, query: search });
    } catch (err) {
      logger.error('Radio search failed:', err);
      return interaction.editReply({ embeds: [embeds.error('I could not reach the radio directory. Please try again in a moment.')] });
    }
    if (stations.length === 0) {
      return interaction.editReply({ embeds: [embeds.error('No working stations found. Try a different language or search word.')] });
    }

    const manager = client.music;
    let chosen = null;
    for (const station of stations.slice(0, MAX_STATIONS_TO_TRY)) {
      const item = {
        title: station.name,
        author: [station.codec.toUpperCase(), station.bitrate ? `${station.bitrate} kbps` : null, station.country]
          .filter(Boolean)
          .join(' • '),
        url: station.url,
        durationMs: 0,
        isLive: true,
        sourceLabel: 'Radio',
        link: null,
        requestedBy: interaction.member?.displayName || interaction.user.username,
      };
      try {
        await manager.resolveItem(item);
        chosen = item;
        break;
      } catch (err) {
        logger.warn(`Station "${station.name}" could not be loaded: ${err.message}`);
      }
    }
    if (!chosen) {
      return interaction.editReply({ embeds: [embeds.error('I found stations but none of them would open right now. Please try again.')] });
    }

    try {
      await manager.playNow({ guild: interaction.guild, voiceChannel, textChannel: interaction.channel }, chosen);
      return interaction.editReply({ embeds: [embeds.info('MUSICO', `📻 Tuning in to **${chosen.title}**.`)] });
    } catch (err) {
      logger.error('Could not start radio:', err);
      return interaction.editReply({ embeds: [embeds.error('I could not start playing. Check that I can join the voice channel.')] });
    }
  },
};
