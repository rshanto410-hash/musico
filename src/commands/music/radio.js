'use strict';

const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const embeds = require('../../utils/embeds');
const logger = require('../../utils/logger');
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
        .setDescription('Optional station name to look for, for example "lofi" or "radio foorti".')
        .setMaxLength(50)
    ),

  async execute(interaction, client) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({
        embeds: [embeds.error('Join a voice channel first, then use /radio again.')],
        ephemeral: true,
      });
    }

    const me = interaction.guild.members.me;
    const perms = voiceChannel.permissionsFor(me);
    if (!perms?.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
      return interaction.reply({
        embeds: [embeds.error('I need the **Connect** and **Speak** permissions in that voice channel.')],
        ephemeral: true,
      });
    }

    const shoukaku = client.shoukaku;
    const node = shoukaku?.getIdealNode();
    if (!node) {
      return interaction.reply({
        embeds: [
          embeds.error(
            'The music server (Lavalink) is not connected. The bot owner needs to start it with `npm run lavalink`.'
          ),
        ],
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const language = interaction.options.getString('language') || 'any';
    const search = interaction.options.getString('search') || '';

    let stations;
    try {
      stations = await searchStations({ language, query: search });
    } catch (err) {
      logger.error('Radio search failed:', err);
      return interaction.editReply({
        embeds: [embeds.error('I could not reach the radio directory. Please try again in a moment.')],
      });
    }

    if (stations.length === 0) {
      return interaction.editReply({
        embeds: [embeds.error('No working stations found. Try a different language or search word.')],
      });
    }

    // Find the first station that Lavalink can actually open.
    let chosen = null;
    let encoded = null;
    for (const station of stations.slice(0, MAX_STATIONS_TO_TRY)) {
      try {
        const result = await node.rest.resolve(station.url);
        if (result?.loadType === 'track' && result.data?.encoded) {
          chosen = station;
          encoded = result.data.encoded;
          break;
        }
      } catch (err) {
        logger.warn(`Station "${station.name}" could not be loaded: ${err.message}`);
      }
    }

    if (!chosen) {
      return interaction.editReply({
        embeds: [embeds.error('I found stations but none of them would open right now. Please try again.')],
      });
    }

    try {
      let player = shoukaku.players.get(interaction.guildId);
      if (!player || player.connection?.channelId !== voiceChannel.id) {
        if (player) await shoukaku.leaveVoiceChannel(interaction.guildId);
        player = await shoukaku.joinVoiceChannel({
          guildId: interaction.guildId,
          channelId: voiceChannel.id,
          shardId: interaction.guild.shardId ?? 0,
          deaf: true,
        });
        player.on('exception', (err) => logger.error('Player exception:', err));
        player.on('stuck', () => logger.warn('Player got stuck.'));
      }
      await player.playTrack({ track: { encoded } });
    } catch (err) {
      logger.error('Could not start playback:', err);
      return interaction.editReply({
        embeds: [embeds.error('I could not start playing. Check that I can join the voice channel.')],
      });
    }

    const details = [chosen.codec.toUpperCase(), chosen.bitrate ? `${chosen.bitrate} kbps` : null, chosen.country]
      .filter(Boolean)
      .join(' • ');

    const embed = embeds
      .info('🎵 Now playing', `**${chosen.name}**`)
      .addFields(
        { name: 'Channel', value: voiceChannel.name, inline: true },
        { name: 'Stream', value: details || 'Live radio', inline: true }
      );
    return interaction.editReply({ embeds: [embed] });
  },
};
