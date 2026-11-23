'use strict';

const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags } = require('discord.js');
const embeds = require('../utils/embeds');

const pending = new Map();
const TTL = 2 * 60 * 1000;

function normalize(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Remove video metadata tags commonly found in YouTube titles
function cleanYouTubeTitle(rawTitle) {
  return String(rawTitle || '')
    .replace(/[\(\[\{][^\)\]\}]*(?:official\s*(?:music\s*)?video|official\s*audio|official\s*lyric\s*video|official\s*stream|audio\s*track|lyrics?|audio|hd|4k|hq|visualizer|clip\s*officiel|video\s*officiel|full\s*song|original\s*mix|original\s*track|original\s*audio)[^\)\]\}]*[\)\]\}]/gi, ' ')
    .replace(/\s*\|\s*.*$/g, '') // remove trailing channel/network pipe
    .replace(/\s+/g, ' ')
    .trim();
}

// Split title into potential Artist and Title parts
function parseArtistAndTitle(rawTitle, author) {
  const cleaned = cleanYouTubeTitle(rawTitle);
  const separatorMatch = cleaned.match(/^(.*?)\s*[-–—:~]\s*(.*)$/);
  if (separatorMatch) {
    return {
      artistPart: separatorMatch[1].trim(),
      titlePart: separatorMatch[2].trim(),
      cleaned,
    };
  }
  return {
    artistPart: author || '',
    titlePart: cleaned,
    cleaned,
  };
}

const UNWANTED_TAGS = [
  'cover',
  'remix',
  'bootleg',
  'tribute',
  'parody',
  'karaoke',
  'instrumental',
  'reaction',
  'bass boosted',
  'slowed',
  'reverb',
  'nightcore',
  'speed up',
  'sped up',
  'tutorial',
  'how to play',
  'guitar lesson',
  'drum cover',
  'piano cover',
  'acoustic cover',
  '8d audio',
];

const OFFICIAL_HINTS = [
  'official music video',
  'official video',
  'official audio',
  'official lyric video',
  'vevo',
  'topic',
];

function rank(item, query) {
  const q = normalize(query);
  if (!q) return 0;

  const rawTitle = String(item.title || '');
  const normRawTitle = normalize(rawTitle);
  const normAuthor = normalize(item.author || '');

  const { artistPart, titlePart, cleaned } = parseArtistAndTitle(rawTitle, item.author);
  const normTitlePart = normalize(titlePart);
  const normArtistPart = normalize(artistPart);
  const normCleaned = normalize(cleaned);

  // Heavy penalty for covers/remixes unless user explicitly asked for them
  let penalty = 0;
  for (const tag of UNWANTED_TAGS) {
    if (!q.includes(tag)) {
      if (normRawTitle.includes(tag) || normAuthor.includes(tag)) {
        penalty += 150;
      }
    }
  }

  // Bonus for official releases
  let bonus = 0;
  for (const hint of OFFICIAL_HINTS) {
    if (normRawTitle.includes(hint) || normAuthor.includes(hint)) {
      bonus += 15;
      break;
    }
  }
  if (normAuthor.endsWith('topic')) {
    bonus += 15;
  }

  // Base score matching
  let baseScore = 0;

  // 1. Exact match on song title part (e.g. user typed "Perfect")
  if (normTitlePart === q || normArtistPart === q || normCleaned === q) {
    baseScore = 120;
  }
  // 2. Exact match on "Artist Song" or "Song Artist"
  else if (
    normCleaned === q ||
    `${normArtistPart} ${normTitlePart}`.trim() === q ||
    `${normTitlePart} ${normArtistPart}`.trim() === q ||
    `${normAuthor} ${normTitlePart}`.trim() === q
  ) {
    baseScore = 110;
  }
  // 3. Song title starts with query
  else if (normTitlePart.startsWith(`${q} `) || normTitlePart.startsWith(q)) {
    baseScore = 85;
  }
  // 4. Song title contains query
  else if (normTitlePart.includes(q)) {
    baseScore = 70;
  }
  // 5. Raw title contains query
  else if (normRawTitle.includes(q)) {
    baseScore = 50;
  }
  // 6. Combined author and title contains query
  else if (`${normAuthor} ${normRawTitle}`.includes(q)) {
    baseScore = 30;
  } else {
    // Unrelated track
    return -999;
  }

  return baseScore + bonus - penalty;
}

function formatDuration(ms) {
  const total = Math.floor((ms || 0) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

function makeSelection(interaction, query, items) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  pending.set(id, {
    userId: interaction.user.id,
    guildId: interaction.guildId,
    voiceChannelId: interaction.member.voice.channelId,
    textChannelId: interaction.channelId,
    items,
    expires: Date.now() + TTL,
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`musico:search:${id}`)
    .setPlaceholder('Choose the exact song to play')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      items.slice(0, 10).map((item, i) => {
        const time = item.isLive ? '🔴 Live' : item.durationMs ? formatDuration(item.durationMs) : '';
        const descParts = [item.author || 'Unknown artist'];
        if (time) descParts.push(time);
        descParts.push(item.sourceLabel || 'YouTube');

        return {
          label: String(item.title || 'Unknown title').slice(0, 100),
          description: descParts.join(' • ').slice(0, 100),
          value: String(i),
        };
      })
    );

  return {
    content: `Search results for **${query.slice(0, 100)}**. Select the exact original recording you want to play:`,
    embeds: [embeds.info('Choose a track', 'Select the exact recording from the list below. MUSICO will not play unrelated songs or covers.')],
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  };
}

async function handleSelection(interaction, client) {
  const id = interaction.customId.slice('musico:search:'.length);
  const data = pending.get(id);
  if (!data || data.expires < Date.now()) {
    pending.delete(id);
    return interaction.update({ content: 'This search has expired. Run `/play` again.', embeds: [], components: [] });
  }
  if (interaction.user.id !== data.userId) {
    return interaction.reply({ content: 'Only the person who started this search can choose a track.', flags: MessageFlags.Ephemeral });
  }
  if (interaction.member?.voice?.channelId !== data.voiceChannelId) {
    return interaction.update({ content: 'Join the same voice channel you used for this search, then run `/play` again.', embeds: [], components: [] });
  }
  const item = data.items[Number(interaction.values[0])];
  pending.delete(id);
  if (!item) return interaction.update({ content: 'That result is no longer available. Run `/play` again.', embeds: [], components: [] });

  await interaction.update({ content: `Preparing **${item.title}** — ${item.author || 'Unknown artist'}…`, embeds: [], components: [] });
  try {
    item.requestedBy = interaction.member?.displayName || interaction.user.username;
    await client.music.resolveItem(item);
    const guild = interaction.guild;
    const voiceChannel =
      guild.channels.cache.get(data.voiceChannelId) ||
      (await guild.channels.fetch(data.voiceChannelId).catch(() => null));
    const textChannel =
      guild.channels.cache.get(data.textChannelId) ||
      (await guild.channels.fetch(data.textChannelId).catch(() => null));

    if (!voiceChannel || !textChannel) throw new Error('The original channel is no longer available.');
    const { startedNow, position } = await client.music.enqueue({ guild, voiceChannel, textChannel }, [item]);
    await interaction.followUp({
      content: startedNow
        ? `▶️ Playing **${item.title}** by ${item.author || 'Unknown artist'}.`
        : `➕ Added **${item.title}** to the queue (position ${position}).`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    await interaction.followUp({ content: `Could not play that exact result: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { normalize, cleanYouTubeTitle, parseArtistAndTitle, rank, makeSelection, handleSelection };
