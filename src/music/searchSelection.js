'use strict';

const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags } = require('discord.js');
const embeds = require('../utils/embeds');

const pending = new Map();
const TTL = 2 * 60 * 1000;

function normalize(text) {
  return String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function rank(item, query) {
  const q = normalize(query);
  const title = normalize(item.title);
  const artist = normalize(item.author);
  if (title === q) return 100;
  if (`${title} ${artist}`.trim() === q || `${artist} ${title}`.trim() === q) return 95;
  if (title.startsWith(`${q} `)) return 75;
  if (title.includes(q)) return 45;
  if (`${title} ${artist}`.includes(q)) return 25;
  return 0;
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
    .setMinValues(1).setMaxValues(1)
    .addOptions(items.slice(0, 10).map((item, i) => ({
      label: String(item.title || 'Unknown title').slice(0, 100),
      description: `${item.author || 'Unknown artist'} • ${item.sourceLabel || 'Music source'}`.slice(0, 100),
      value: String(i),
    })));
  return {
    content: `Search results for **${query.slice(0, 100)}**. Select the song you mean; MUSICO will not guess or play a different result.`,
    embeds: [embeds.info('Choose a track', 'If the exact recording is not listed, do not select a similar song.')],
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
    const voiceChannel = guild.channels.cache.get(data.voiceChannelId);
    const textChannel = guild.channels.cache.get(data.textChannelId);
    if (!voiceChannel || !textChannel) throw new Error('The original channel is no longer available.');
    const { startedNow, position } = await client.music.enqueue({ guild, voiceChannel, textChannel }, [item]);
    await interaction.followUp({ content: startedNow ? `▶️ Playing **${item.title}** by ${item.author || 'Unknown artist'}.` : `➕ Added **${item.title}** to the queue (position ${position}).`, flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.followUp({ content: `Could not play that exact result: ${err.message}`, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { rank, makeSelection, handleSelection };
