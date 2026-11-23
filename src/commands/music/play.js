'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embeds = require('../../utils/embeds');
const logger = require('../../utils/logger');
const { preparePlayback } = require('../../music/guards');
const { searchAudius } = require('../../music/audius');
const { isSafeStreamUrl } = require('../../music/radio');
const { rank, makeSelection, normalize } = require('../../music/searchSelection');

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
  aliases: ['p'],
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play an exact song match or a direct public audio link.')
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('song')
        .setDescription('Song title (e.g. Perfect), optionally include artist, or direct audio link')
        .setRequired(true)
        .setMaxLength(200)
    ),

  async execute(interaction, client) {
    const voiceChannel = await preparePlayback(interaction, client);
    if (!voiceChannel) return undefined;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const input = interaction.options.getString('song', true).trim();
    const manager = client.music;
    let candidates = [];

    if (isUrl(input)) {
      if (!isSafeStreamUrl(input)) {
        return interaction.editReply({ embeds: [embeds.error('That link is not allowed. Use a public http(s) audio link.')] });
      }
      candidates = [itemFromUrl(input)];
    } else {
      // 1. YouTube is the primary search source via Lavalink YouTube plugin
      const node = manager.shoukaku.getIdealNode();
      let youtubeSearchWorked = false;

      if (node) {
        // Query YouTube Music first for official studio tracks, then YouTube
        try {
          const ytmResponse = await node.rest.resolve(`ytmsearch:${input}`);
          if (ytmResponse?.loadType === 'search' && Array.isArray(ytmResponse.data) && ytmResponse.data.length > 0) {
            youtubeSearchWorked = true;
            candidates.push(
              ...ytmResponse.data.map((track) => ({
                title: track.info.title,
                author: track.info.author,
                url: track.info.uri || '',
                encoded: track.encoded,
                durationMs: track.info.length || 0,
                isLive: Boolean(track.info.isStream),
                sourceLabel: 'YouTube',
                link: track.info.uri || null,
              }))
            );
          }
        } catch (err) {
          logger.warn(`YouTube Music search via Lavalink failed: ${err.message}`);
        }

        try {
          const ytResponse = await node.rest.resolve(`ytsearch:${input}`);
          if (ytResponse?.loadType === 'search' && Array.isArray(ytResponse.data) && ytResponse.data.length > 0) {
            youtubeSearchWorked = true;
            candidates.push(
              ...ytResponse.data.map((track) => ({
                title: track.info.title,
                author: track.info.author,
                url: track.info.uri || '',
                encoded: track.encoded,
                durationMs: track.info.length || 0,
                isLive: Boolean(track.info.isStream),
                sourceLabel: 'YouTube',
                link: track.info.uri || null,
              }))
            );
          }
        } catch (err) {
          logger.warn(`YouTube search via Lavalink failed: ${err.message}`);
        }
      }

      // 2. Only if YouTube search yielded no results, fall back to Audius
      if (candidates.length === 0 && !youtubeSearchWorked) {
        try {
          candidates = await searchAudius(input);
        } catch (err) {
          logger.warn(`Audius fallback search failed: ${err.message}`);
        }
      }

      // Deduplicate items
      const seen = new Set();
      candidates = candidates.filter((item) => {
        const key = `${normalize(item.title)}|${normalize(item.author)}|${item.sourceLabel}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Rank items accurately with smart song-title parser
      const scoredCandidates = candidates
        .map((item, index) => ({ item, index, score: rank(item, input) }))
        .filter(({ score }) => score > 0) // Filter out negative/unrelated scores
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(({ item }) => item)
        .slice(0, 10);

      // If all candidates had negative scores, fall back to top candidates or show not found
      const finalCandidates = scoredCandidates.length > 0 ? scoredCandidates : candidates.slice(0, 5);

      if (finalCandidates.length === 0) {
        return interaction.editReply({
          embeds: [embeds.error(`No accurate results found for **${input.slice(0, 60)}**. Nothing was played.`)],
        });
      }

      // Never auto-play. Present selection menu for user confirmation.
      return interaction.editReply(makeSelection(interaction, input, finalCandidates));
    }

    // Direct link path:
    let chosen = null;
    for (const candidate of candidates.slice(0, 5)) {
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
      return interaction.editReply({ embeds: [embeds.error('Could not open the audio stream for that link. Nothing was played.')] });
    }

    try {
      const { startedNow, position } = await manager.enqueue(
        { guild: interaction.guild, voiceChannel, textChannel: interaction.channel },
        [chosen]
      );
      const message = startedNow
        ? `▶️ Starting **${chosen.title}** by ${chosen.author}.`
        : `➕ Added **${chosen.title}** to the queue (position ${position}).`;
      return interaction.editReply({ embeds: [embeds.info('MUSICO', message)] });
    } catch (err) {
      logger.error('Could not start playback:', err);
      return interaction.editReply({ embeds: [embeds.error('I could not start playing. Check that I can join the voice channel.')] });
    }
  },
};
