'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

const LOOP_LABEL = { off: 'Loop: off', track: 'Loop: song', queue: 'Loop: queue' };

function formatDuration(ms) {
  const total = Math.floor((ms || 0) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

function durationText(item) {
  if (item.isLive) return '🔴 Live';
  return item.durationMs ? formatDuration(item.durationMs) : 'Unknown';
}

/** The purple "Now playing" embed. */
function buildEmbed(queue) {
  const item = queue.current;
  const embed = embeds.base().setTitle(queue.paused ? '⏸ Paused' : '🎵 Now playing');

  if (!item) return embed.setDescription('Nothing is playing right now.');

  embed.setDescription(`**${item.title}**\n${item.author || ''}`.trim());
  embed.addFields(
    { name: 'Duration', value: durationText(item), inline: true },
    { name: 'Loop', value: queue.loop === 'off' ? 'Off' : queue.loop === 'track' ? 'Song' : 'Queue', inline: true },
    { name: 'Up next', value: queue.upcoming[0] ? queue.upcoming[0].title.slice(0, 100) : '—', inline: true }
  );
  if (item.sourceLabel === 'Jamendo' && item.link) {
    embed.addFields({ name: 'Credit', value: `Music by ${item.author} • [Jamendo](${item.link})` });
  }
  if (item.requestedBy) embed.addFields({ name: 'Requested by', value: item.requestedBy, inline: true });
  return embed;
}

/** Embed + control buttons. */
function buildPanel(queue) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('musico:prev').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('musico:toggle')
      .setEmoji(queue.paused ? '▶️' : '⏸️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('musico:skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('musico:stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('musico:loop')
      .setEmoji('🔁')
      .setLabel(LOOP_LABEL[queue.loop])
      .setStyle(queue.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success)
  );
  return { embeds: [buildEmbed(queue)], components: [row] };
}

/** Remove the old panel (if any) and post a fresh one in the text channel. */
async function show(queue) {
  await clear(queue);
  if (!queue.textChannel) return;
  try {
    queue.panel = await queue.textChannel.send(buildPanel(queue));
  } catch (err) {
    logger.warn(`Could not post the player panel: ${err.message}`);
  }
}

async function clear(queue) {
  if (!queue.panel) return;
  const panel = queue.panel;
  queue.panel = null;
  await panel.delete().catch(() => {});
}

module.exports = { show, clear, buildPanel, buildEmbed, formatDuration };
