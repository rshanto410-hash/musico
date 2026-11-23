'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const embeds = require('../../utils/embeds');
const logger = require('../../utils/logger');
const { preparePlayback } = require('../../music/guards');
const { searchJamendo } = require('../../music/jamendo');
const { isSafeStreamUrl } = require('../../music/radio');

function isUrl(text) {
  return /^https?:\/\//i.test(text);
}

function itemFromUrl(text) {
  const url = new URL(text);
  const lastPart = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
  return {
    title: (lastPart || url.hostname).slice(0, 100),
    author: url.hostname,
    url: text,
    durationMs: 0,
    isLive: false,
    sourceLabel: 'Link',
    link: null,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song by name (free Jamendo music) or from a direct audio link.')
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('song')
        .setDescription('Song name, artist, or a direct http(s) audio link')
        .setRequired(true)
        .setMaxLength(200)
    ),

  async execute(interaction, client) {
    const voiceChannel = await preparePlayback(interaction, client);
    if (!voiceChannel) return undefined;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const input = interaction.options.getString('song', true).trim();
    const manager = client.music;

    // 1. Work out which songs to try.
    let candidates;
    if (isUrl(input)) {
      if (!isSafeStreamUrl(input)) {
        return interaction.editReply({ embeds: [embeds.error('That link is not allowed. Use a public http(s) audio link.')] });
      }
      candidates = [itemFromUrl(input)];
    } else {
      try {
        candidates = await searchJamendo(input, config.jamendoClientId);
      } catch (err) {
        if (err.message === 'JAMENDO_NOT_CONFIGURED') {
          return interaction.editReply({
            embeds: [
              embeds.error(
                'Searching by song name is not set up yet (the bot owner needs a free Jamendo Client ID). You can still use a direct audio link or `/radio`.'
              ),
            ],
          });
        }
        logger.error('Jamendo search failed:', err);
        return interaction.editReply({ embeds: [embeds.error('The music search is not reachable right now. Please try again.')] });
      }
      if (candidates.length === 0) {
        return interaction.editReply({
          embeds: [embeds.error(`No free songs found for **${input.slice(0, 60)}**. Try another name, or an artist from Jamendo.`)],
        });
      }
    }

    // 2. Pick the first one Lavalink can actually open.
    let chosen = null;
    for (const candidate of candidates.slice(0, 3)) {
      try {
        candidate.requestedBy = interaction.member?.displayName || interaction.user.username;
        await manager.resolveItem(candidate);
        chosen = candidate;
        break;
      } catch (err) {
        logger.warn(`Could not open "${candidate.title}": ${err.message}`);
      }
    }
    if (!chosen) {
      return interaction.editReply({ embeds: [embeds.error('I found songs but could not open any of them. Please try again.')] });
    }

    // 3. Queue it.
    try {
      const { startedNow, position } = await manager.enqueue(
        { guild: interaction.guild, voiceChannel, textChannel: interaction.channel },
        [chosen]
      );
      const text = startedNow
        ? `▶️ Starting **${chosen.title}** by ${chosen.author}.`
        : `➕ Added **${chosen.title}** to the queue (position ${position}).`;
      return interaction.editReply({ embeds: [embeds.info('MUSICO', text)] });
    } catch (err) {
      logger.error('Could not start playback:', err);
      return interaction.editReply({ embeds: [embeds.error('I could not start playing. Check that I can join the voice channel.')] });
    }
  },
};
