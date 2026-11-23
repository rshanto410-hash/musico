'use strict';

const { Shoukaku, Connectors } = require('shoukaku');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Connects the bot to the Lavalink audio server (the part that actually streams audio).
 * Call once, before client.login().
 */
function createShoukaku(client) {
  const nodes = [
    {
      name: 'local',
      url: config.lavalink.url,
      auth: config.lavalink.password,
    },
  ];

  const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
    moveOnDisconnect: false,
    resume: false,
    reconnectTries: 10,
    reconnectInterval: 5,
    restTimeout: 15000,
  });

  shoukaku.on('ready', (name) => logger.info(`Lavalink node "${name}" is connected.`));
  shoukaku.on('error', (name, error) => logger.error(`Lavalink node "${name}" error:`, error));
  shoukaku.on('close', (name, code, reason) =>
    logger.warn(`Lavalink node "${name}" closed (code ${code}) ${reason || ''}`)
  );
  shoukaku.on('disconnect', (name, count) =>
    logger.warn(`Lavalink node "${name}" disconnected (${count} player(s) affected).`)
  );

  return shoukaku;
}

module.exports = { createShoukaku };
