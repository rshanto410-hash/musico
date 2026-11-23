'use strict';

const { Events, PermissionsBitField } = require('discord.js');
const logger = require('../utils/logger');
const embeds = require('../utils/embeds');
const { parseMentionCommand } = require('../music/mention');

function say(message, embed) {
  return message.channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch((err) => {
    logger.warn(`Could not send a message in #${message.channel?.name}: ${err.message}`);
  });
}

async function handleJoin(message, client) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    return say(message, embeds.error('Join a voice channel first, then mention me again.'));
  }

  const perms = voiceChannel.permissionsFor(message.guild.members.me);
  if (!perms?.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
    return say(message, embeds.error('I need the **Connect** and **Speak** permissions in that voice channel.'));
  }
  if (!client.shoukaku?.getIdealNode()) {
    return say(
      message,
      embeds.error('The music server (Lavalink) is not connected. The bot owner needs to start it with `npm run lavalink`.')
    );
  }

  try {
    await client.music.join({ guild: message.guild, voiceChannel, textChannel: message.channel });
  } catch (err) {
    logger.error('Could not join voice channel:', err);
    return say(message, embeds.error('I could not join the voice channel. Check that I can connect and speak there.'));
  }
  return say(message, embeds.success(`Joined **${voiceChannel.name}**. Use \`/p\` to play a song, or mention me with **l** to leave.`));
}

async function handleLeave(message, client) {
  const player = client.shoukaku?.players.get(message.guild.id);
  const voice = message.member?.voice?.channel;

  if (!player) return say(message, embeds.error('I am not in a voice channel.'));
  if (!voice || client.music.botChannelId(message.guild.id) !== voice.id) {
    return say(message, embeds.error('You need to be in my voice channel to send me away.'));
  }

  await client.music.stop(message.guild.id);
  return say(message, embeds.success('Left the voice channel. See you!'));
}

module.exports = {
  name: Events.MessageCreate,
  async execute(client, message) {
    if (message.author.bot || !message.guild || !client.user) return;

    const parsed = parseMentionCommand(message.content, client.user.id);
    if (!parsed) return;

    try {
      if (parsed.command === 'join') return await handleJoin(message, client);
      if (parsed.command === 'leave') return await handleLeave(message, client);
      return await say(
        message,
        embeds.info(
          'MUSICO',
          'Mention me with **j** to join your voice channel, or **l** to make me leave.\nPlay songs with `/p`, and use the buttons on the player.'
        )
      );
    } catch (err) {
      logger.error('Error in mention command:', err);
      return say(message, embeds.error('Something went wrong. Please try again.'));
    }
  },
};
