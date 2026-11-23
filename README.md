# MUSICO

**YOUR MUSIC. YOUR SERVER. YOUR VIBE.**

A custom Discord music bot built with Node.js and discord.js.

## Status

Stage 02 - foundation only. Working so far: project structure, config + secret
handling, logger, command/event loaders, `/ping`, health check.
Music features (Lavalink), database, and dashboard come in later stages.

## Project structure

```
src/
  commands/    slash commands (grouped in folders)
  events/      Discord event handlers
  music/       (later) Lavalink player logic
  dashboard/   (later) web dashboard
  database/    (later) persistent settings
  utils/       logger, embeds, loaders
  config/      environment + branding
```

## Secrets (required)

| Name | Where to find it |
|------|------------------|
| `DISCORD_TOKEN` | Developer Portal -> Bot -> Reset Token |
| `CLIENT_ID` | Developer Portal -> General Information -> Application ID |
| `GUILD_ID` (optional) | Discord: right-click your server -> Copy Server ID (needs Developer Mode on) |

On Replit, add these in the **Secrets** tool. Never put them in code, never commit `.env`.

## Commands

```
npm install        # install dependencies
npm run deploy     # register slash commands with Discord
npm start          # start the bot
```

## Health check

`GET /health` returns `{"status":"ok"}` once the bot is connected.


## MUSICO update

- `/play` now requires an exact normalized song-title match (or exact title + artist).
- Similar titles are shown as suggestions and are never auto-played.
- If an exact result cannot be opened, playback stops instead of falling back to an unrelated song.
