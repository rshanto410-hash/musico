'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const embeds = require('../../utils/embeds');
const logger = require('../../utils/logger');
const { preparePlayback } = require('../../music/guards');
const { searchJamendo } = require('../../music/jamendo');
const { searchAudius } = require('../../music/audius');
const { isSafeStreamUrl } = require('../../music/radio');
const { rank, makeSelection } = require('../../music/searchSelection');

function isUrl(text) {
  return /^https?:\/\//i.test(text);
}

function normalize(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
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
        .setDescription('Exact song title (optionally include artist), or a direct audio link')
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
      const searches = [searchAudius(input)];

      // Search YouTube through the Lavalink YouTube plugin.
      const node = manager.shoukaku.getIdealNode();
      if (node) {
        searches.push((async () => {
          const response = await node.rest.resolve(`ytsearch:${input}`);
          if (response?.loadType !== 'search' || !Array.isArray(response.data)) return [];

          return response.data.map((track) => ({
            title: track.info.title,
            author: track.info.author,
            url: track.info.uri || '',
            encoded: track.encoded,
            durationMs: track.info.length || 0,
            isLive: Boolean(track.info.isStream),
            sourceLabel: 'YouTube',
            link: track.info.uri || null,
          }));
        })());
      }

      if (config.jamendoClientId) searches.push(searchJamendo(input, config.jamendoClientId));

      const results = await Promise.allSettled(searches);
      let searchWorked = false;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          searchWorked = true;
          candidates.push(...result.value);
        } else {
          logger.warn(`A music search provider failed: ${result.reason?.message || result.reason}`);
        }
      }

      // Remove duplicate tracks, then require an exact title (or exact title + artist).
      const seen = new Set();
      candidates = candidates.filter((item) => {
        const key = `${normalize(item.title)}|${normalize(item.author)}|${item.sourceLabel}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (!searchWorked) {
        return interaction.editReply({ embeds: [embeds.error('Music search is unavailable right now. Please try again later.')] });
      }
      candidates = candidates
        .map((item, index) => ({ item, index, score: Number.isFinite(item.match) ? item.match * 10 : rank(item, input) }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(({ item }) => item)
        .slice(0, 10);
      if (candidates.length === 0) {
        return interaction.editReply({ embeds: [embeds.error(`No results found for **${input.slice(0, 60)}**. Nothing was played.`)] });
      }
      // Never auto-play the first search result. Let the user confirm the exact recording.
      return interaction.editReply(makeSelection(interaction, input, candidates));
    }

    let chosen = null;
    for (const candidate of candidates.slice(0, 10)) {
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
      return interaction.editReply({ embeds: [embeds.error('I found the exact song, but its audio stream could not be opened. Nothing else was played.')] });
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
