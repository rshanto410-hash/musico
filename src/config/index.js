'use strict';

require('dotenv').config();

const REQUIRED = ['DISCORD_TOKEN', 'CLIENT_ID'];

const missing = REQUIRED.filter((key) => !process.env[key] || !process.env[key].trim());
if (missing.length > 0) {
  console.error(
    `[MUSICO] Missing required environment variable(s): ${missing.join(', ')}.\n` +
      'On Replit, add them in the Secrets tool. Locally, copy .env.example to .env.'
  );
  process.exit(1);
}

module.exports = Object.freeze({
  token: process.env.DISCORD_TOKEN.trim(),
  clientId: process.env.CLIENT_ID.trim(),
  guildId: (process.env.GUILD_ID || '').trim() || null,
  port: Number.parseInt(process.env.PORT, 10) || 3000,
  logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase(),

  brand: Object.freeze({
    name: 'MUSICO',
    tagline: 'YOUR MUSIC. YOUR SERVER. YOUR VIBE.',
    colors: Object.freeze({
      purple: 0x9d00ff, // Neon Purple
      black: 0x0b0b0f,
      white: 0xffffff,
    }),
  }),
});
