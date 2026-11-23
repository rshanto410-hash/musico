'use strict';

const { PermissionsBitField, MessageFlags } = require('discord.js');
const embeds = require('../utils/embeds');

function replyError(interaction, text) {
  return interaction.reply({ embeds: [embeds.error(text)], flags: MessageFlags.Ephemeral });
}

/**
 * For controls like /skip and the buttons: the user must be in the same voice
 * channel as the bot, and something must be loaded.
 * Returns { error } or { manager, queue, player, voice }.
 */
function checkVoice(interaction, client) {
  const manager = client.music;
  const voice = interaction.member?.voice?.channel;
  if (!voice) return { error: 'Join a voice channel first.' };

  const player = client.shoukaku?.players.get(interaction.guildId);
  const queue = manager?.getQueue(interaction.guildId);
  if (!player || !queue) return { error: 'Nothing is playing right now.' };
  if (player.connection?.channelId !== voice.id) {
    return { error: 'You need to be in my voice channel to do that.' };
  }
  return { manager, queue, player, voice };
}

/**
 * For /play and /radio: checks the user is in a voice channel, the bot may
 * connect and speak, and Lavalink is running. Replies with an error and returns
 * null if something is wrong; otherwise returns the voice channel.
 */
async function preparePlayback(interaction, client) {
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    await replyError(interaction, 'Join a voice channel first, then try again.');
    return null;
  }

  const perms = voiceChannel.permissionsFor(interaction.guild.members.me);
  if (!perms?.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
    await replyError(interaction, 'I need the **Connect** and **Speak** permissions in that voice channel.');
    return null;
  }

  if (!client.shoukaku?.getIdealNode()) {
    await replyError(
      interaction,
      'The music server (Lavalink) is not connected. The bot owner needs to start it with `npm run lavalink`.'
    );
    return null;
  }
  return voiceChannel;
}

module.exports = { checkVoice, preparePlayback, replyError };
