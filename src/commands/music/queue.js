'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embeds = require('../../utils/embeds');
const { formatDuration } = require('../../music/panel');

module.exports = {
  aliases: ['q'],
  data: new SlashCommandBuilder().setName('queue').setDescription('Show what is playing and what is coming up.').setDMPermission(false),

  async execute(interaction, client) {
    const queue = client.music?.getQueue(interaction.guildId);
    if (!queue?.isActive) {
      return interaction.reply({ embeds: [embeds.error('The queue is empty.')], flags: MessageFlags.Ephemeral });
    }

    const now = queue.current;
    const lines = queue.upcoming.slice(0, 10).map((item, i) => {
      const time = item.isLive ? 'live' : item.durationMs ? formatDuration(item.durationMs) : '';
      return `**${i + 1}.** ${item.title.slice(0, 60)}${time ? ` \`${time}\`` : ''}`;
    });
    const more = queue.upcoming.length > 10 ? `\n…and ${queue.upcoming.length - 10} more` : '';

    const embed = embeds
      .info('📜 Queue', `**Now:** ${now.title}\n\n${lines.length ? lines.join('\n') + more : 'Nothing else queued.'}`)
      .addFields({ name: 'Loop', value: queue.loop, inline: true });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
