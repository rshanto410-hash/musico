'use strict';

const http = require('node:http');
const path = require('node:path');
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');
const { loadCommands, loadEvents } = require('./utils/loader');
const { createShoukaku } = require('./music/lavalink');
const { MusicManager } = require('./music/manager');
const panel = require('./music/panel');

const client = new Client({
  // GuildMessages lets the bot see messages that mention it ("@MUSICO j").
  // Reading the text of those messages needs no privileged intent.
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages],
});

// Audio connection (Lavalink). Commands reach it through client.shoukaku.
client.shoukaku = createShoukaku(client);
// Queue + playback controls for every server. Commands and buttons use client.music.
client.music = new MusicManager(client, panel);

client.commands = loadCommands(path.join(__dirname, 'commands'), logger);
const eventCount = loadEvents(path.join(__dirname, 'events'), client, logger);
logger.info(`Loaded ${client.commands.size} command(s) and ${eventCount} event(s).`);

// Health check: open the Replit web preview (or GET /health) to see status.
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    const ready = client.isReady();
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: ready ? 'ok' : 'starting', uptimeSeconds: Math.round(process.uptime()) }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`${config.brand.name} - ${config.brand.tagline}`);
});
server.listen(config.port, '0.0.0.0', () => logger.info(`Health server listening on port ${config.port}.`));

client.on('error', (err) => logger.error('Client error:', err));
client.on('warn', (msg) => logger.warn(msg));
process.on('unhandledRejection', (err) => logger.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => logger.error('Uncaught exception:', err));

function shutdown(signal) {
  logger.info(`${signal} received, shutting down...`);
  server.close();
  client.destroy();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(config.token).catch((err) => {
  logger.error('Login failed. Check DISCORD_TOKEN in Secrets:', err);
  process.exit(1);
});
