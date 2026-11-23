'use strict';

// Understands messages like "@MUSICO j" or "@MUSICO leave".
// Discord lets a bot read the text of messages that mention it, so no special
// permission (Message Content Intent) is needed. No dependencies, easy to test.

const COMMANDS = Object.freeze({
  j: 'join',
  join: 'join',
  l: 'leave',
  leave: 'leave',
});

/**
 * @returns {{command: string|null, word: string}|null} null when the message does not start with a mention of the bot.
 */
function parseMentionCommand(content, botId) {
  if (typeof content !== 'string' || !/^\d+$/.test(String(botId))) return null;
  const match = content.match(new RegExp(`^\\s*<@!?${botId}>\\s*([\\s\\S]*)$`));
  if (!match) return null;

  const word = (match[1].trim().split(/\s+/)[0] || '').toLowerCase();
  return { command: COMMANDS[word] || null, word };
}

module.exports = { parseMentionCommand, COMMANDS };
