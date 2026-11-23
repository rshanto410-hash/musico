'use strict';

// Pure queue logic (no Discord or Lavalink code), so it is easy to test.

const LOOP_MODES = ['off', 'track', 'queue'];
const MAX_HISTORY = 25;

class GuildQueue {
  constructor(guildId) {
    this.guildId = guildId;
    this.current = null;
    this.upcoming = [];
    this.history = [];
    this.loop = 'off';
    this.paused = false;
    this.textChannel = null;
    this.panel = null;
    this.idleTimer = null;
  }

  get isActive() {
    return this.current !== null;
  }

  add(item) {
    this.upcoming.push(item);
  }

  /**
   * Move to the next song and return it (or null when the queue is finished).
   * @param {boolean} force true for Skip: ignores "loop song".
   */
  next(force = false) {
    if (this.loop === 'track' && this.current && !force) return this.current;

    if (this.current) {
      this.history.push(this.current);
      if (this.history.length > MAX_HISTORY) this.history.shift();
      if (this.loop === 'queue') this.upcoming.push(this.current);
    }
    this.current = this.upcoming.shift() || null;
    return this.current;
  }

  /** Go back to the previous song. Returns it, or null if there is none. */
  previous() {
    const previous = this.history.pop();
    if (!previous) return null;
    if (this.current) this.upcoming.unshift(this.current);
    this.current = previous;
    return previous;
  }

  cycleLoop() {
    this.loop = LOOP_MODES[(LOOP_MODES.indexOf(this.loop) + 1) % LOOP_MODES.length];
    return this.loop;
  }

  clear() {
    this.current = null;
    this.upcoming = [];
    this.history = [];
    this.paused = false;
  }
}

module.exports = { GuildQueue, LOOP_MODES };
