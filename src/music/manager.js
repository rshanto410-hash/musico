'use strict';

const { GuildQueue } = require('./queue');
const logger = require('../utils/logger');
const embeds = require('../utils/embeds');

const IDLE_LEAVE_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Controls playback for every server: joining voice, the queue, skip/previous/pause/loop.
 * `ui` must provide show(queue) and clear(queue) to display or remove the player panel.
 */
class MusicManager {
  constructor(client, ui) {
    this.client = client;
    this.ui = ui;
    this.queues = new Map();
  }

  get shoukaku() {
    return this.client.shoukaku;
  }

  getQueue(guildId) {
    return this.queues.get(guildId) || null;
  }

  /** The voice channel the bot is really in (asks Discord, which is always right). */
  botChannelId(guildId) {
    const fromDiscord = this.client.guilds?.cache?.get(guildId)?.members?.me?.voice?.channelId;
    return fromDiscord || this.shoukaku.connections?.get(guildId)?.channelId || this.getPlayer(guildId)?.connection?.channelId || null;
  }

  getPlayer(guildId) {
    return this.shoukaku.players.get(guildId) || null;
  }

  _getOrCreateQueue(guildId) {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = new GuildQueue(guildId);
      this.queues.set(guildId, queue);
    }
    return queue;
  }

  /** Make sure Lavalink can open this song. Throws a readable error if not. */
  async resolveItem(item) {
    if (item.encoded) return item;
    const node = this.shoukaku.getIdealNode();
    if (!node) throw new Error('The music server (Lavalink) is not connected.');
    const result = await node.rest.resolve(item.url);
    if (result?.loadType !== 'track' || !result.data?.encoded) {
      throw new Error(`Could not open "${item.title}".`);
    }
    item.encoded = result.data.encoded;
    return item;
  }

  async _ensurePlayer(guild, voiceChannel) {
    let player = this.getPlayer(guild.id);
    if (player && this.botChannelId(guild.id) === voiceChannel.id) return player;
    if (player || this.shoukaku.connections?.has(guild.id)) {
      await this.shoukaku.leaveVoiceChannel(guild.id);
    }

    player = await this.shoukaku.joinVoiceChannel({
      guildId: guild.id,
      channelId: voiceChannel.id,
      shardId: guild.shardId ?? 0,
      deaf: false,
    });

    // Give Lavalink a moment to establish the voice connection before sending audio
    await new Promise((resolve) => setTimeout(resolve, 1000));

    player.on('start', () => logger.info(`Track started in Lavalink for guild ${guild.id}.`));
    player.on('end', (data) => {
      logger.info(`Track ended in Lavalink for guild ${guild.id} (reason: ${data?.reason}).`);
      this._onTrackEnd(guild.id, data);
    });
    player.on('exception', (err) => {
      const rawMsg = err?.exception?.message || JSON.stringify(err?.exception ?? err);
      logger.error(`Player exception in guild ${guild.id}: ${rawMsg}`);
      const queue = this.getQueue(guild.id);
      if (queue?.textChannel && queue.current) {
        let userMsg = rawMsg;
        if (rawMsg.includes('requires login')) {
          userMsg = 'YouTube requires account authorization. Please authorize the device code shown in your Lavalink console at https://www.google.com/device.';
        } else if (rawMsg.includes('All clients failed')) {
          userMsg = 'All playback streams failed to load for this track. Please ensure Lavalink has restarted with the updated plugin.';
        }
        queue.textChannel.send({
          embeds: [embeds.error(`Playback error on **${queue.current.title}**: ${userMsg}`)],
        }).catch(() => {});
      }
    });
    player.on('stuck', () => {
      logger.warn(`Player got stuck in guild ${guild.id}, skipping.`);
      const queue = this.getQueue(guild.id);
      if (queue?.isActive) this._advance(queue, true).catch((e) => logger.error('Skip after stuck failed:', e));
    });
    player.on('closed', (data) => logger.warn(`Voice connection closed for guild ${guild.id} (code ${data?.code}).`));
    return player;
  }

  /** Join a voice channel and wait there for songs. Leaves after a while if nothing is played. */
  async join({ guild, voiceChannel, textChannel }) {
    const queue = this._getOrCreateQueue(guild.id);
    queue.textChannel = textChannel;
    await this._ensurePlayer(guild, voiceChannel);
    if (!queue.isActive) this._scheduleIdle(queue);
  }

  /**
   * Add songs to the queue. Starts playing right away if nothing is playing.
   * @param {{guild: object, voiceChannel: object, textChannel: object}} context
   */
  async enqueue({ guild, voiceChannel, textChannel }, items) {
    const queue = this._getOrCreateQueue(guild.id);
    queue.textChannel = textChannel;
    this._cancelIdle(queue);
    await this._ensurePlayer(guild, voiceChannel);

    const startedNow = !queue.isActive;
    if (startedNow) queue.paused = false;
    for (const item of items) queue.add(item);
    const position = queue.upcoming.length;
    if (startedNow) await this._advance(queue, true);
    return { startedNow, position };
  }

  /** Replace everything with a single song (used by /radio). */
  async playNow(context, item) {
    const queue = this._getOrCreateQueue(context.guild.id);
    queue.upcoming = [];
    queue.current = null;
    return this.enqueue(context, [item]);
  }

  async _playItem(queue, item) {
    const player = this.getPlayer(queue.guildId);
    if (!player) throw new Error('Not connected to a voice channel.');
    await this.resolveItem(item);

    // Explicitly unpause in queue state and send paused: false to Lavalink REST API
    queue.paused = false;
    logger.info(`Playing "${item.title}" from ${item.sourceLabel || 'unknown source'}.`);
    await player.playTrack({ track: { encoded: item.encoded }, paused: false });
    await player.setGlobalVolume(100);
  }

  /** Move to the next song, skipping any that fail to load. */
  async _advance(queue, force = false) {
    let forceNext = force;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const item = queue.next(forceNext);
      forceNext = true; // after a failure never replay the broken song
      if (!item) break;
      try {
        await this._playItem(queue, item);
        await this.ui.show(queue);
        return;
      } catch (err) {
        logger.warn(`Skipping "${item.title}": ${err.message}`);
      }
    }
    await this._onQueueEnd(queue);
  }

  async _onQueueEnd(queue) {
    queue.current = null;
    queue.paused = false;
    const player = this.getPlayer(queue.guildId);
    if (player) {
      try {
        await player.stopTrack();
      } catch {
        /* nothing was playing */
      }
    }
    await this.ui.clear(queue);
    this._scheduleIdle(queue);
  }

  _onTrackEnd(guildId, data) {
    const reason = data?.reason;
    if (reason !== 'finished' && reason !== 'loadFailed') return;
    const queue = this.getQueue(guildId);
    if (!queue?.isActive) return;

    if (reason === 'loadFailed') {
      logger.warn(`Track load failed in Lavalink for guild ${guildId}, advancing queue.`);
      if (queue.textChannel && queue.current) {
        queue.textChannel.send({
          embeds: [embeds.error(`Could not load audio for **${queue.current.title}**. Skipping to next track.`)],
        }).catch(() => {});
      }
    }

    this._advance(queue, false).catch((err) => logger.error('Could not advance queue:', err));
  }

  _scheduleIdle(queue) {
    this._cancelIdle(queue);
    queue.idleTimer = setTimeout(() => {
      if (!queue.isActive) this.stop(queue.guildId).catch((err) => logger.error('Idle leave failed:', err));
    }, IDLE_LEAVE_MS);
    queue.idleTimer.unref?.();
  }

  _cancelIdle(queue) {
    if (queue.idleTimer) {
      clearTimeout(queue.idleTimer);
      queue.idleTimer = null;
    }
  }

  async skip(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue?.isActive) return false;
    await this._advance(queue, true);
    return true;
  }

  async previous(guildId) {
    const queue = this.getQueue(guildId);
    if (!queue) return false;
    const item = queue.previous();
    if (!item) return false;
    try {
      await this._playItem(queue, item);
      await this.ui.show(queue);
    } catch (err) {
      logger.warn(`Could not replay "${item.title}": ${err.message}`);
      await this._advance(queue, true);
    }
    return true;
  }

  async togglePause(guildId) {
    const queue = this.getQueue(guildId);
    const player = this.getPlayer(guildId);
    if (!queue || !player) return null;
    const paused = !queue.paused;
    await player.setPaused(paused);
    queue.paused = paused;
    return paused;
  }

  async setPaused(guildId, paused) {
    const queue = this.getQueue(guildId);
    const player = this.getPlayer(guildId);
    if (!queue || !player) return null;
    await player.setPaused(paused);
    queue.paused = paused;
    return paused;
  }

  cycleLoop(guildId) {
    const queue = this.getQueue(guildId);
    return queue ? queue.cycleLoop() : null;
  }

  /** Stop the music, clear the queue and leave the voice channel. */
  async stop(guildId) {
    const queue = this.getQueue(guildId);
    if (queue) {
      this._cancelIdle(queue);
      queue.clear();
      await this.ui.clear(queue);
      this.queues.delete(guildId);
    }
    if (this.getPlayer(guildId)) await this.shoukaku.leaveVoiceChannel(guildId);
  }
}

module.exports = { MusicManager };
