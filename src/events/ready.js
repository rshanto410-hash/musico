'use strict';

const { Events, ActivityType } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`MUSICO is online as ${client.user.tag} in ${client.guilds.cache.size} server(s).`);
    client.user.setPresence({
      status: 'online',
      activities: [{ name: '/play • MUSICO', type: ActivityType.Listening }],
    });
  },
};
