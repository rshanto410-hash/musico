'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Recursively collect every .js file inside a directory. */
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

/** Load all slash commands. Each file must export { data, execute }. */
function loadCommands(dir, logger) {
  const commands = new Map();
  for (const file of walk(dir)) {
    const command = require(file);
    if (!command.data || typeof command.execute !== 'function') {
      logger.warn(`Skipping ${path.relative(dir, file)}: needs "data" and "execute".`);
      continue;
    }
    commands.set(command.data.name, command);
  }
  return commands;
}

/** Load all events. Each file must export { name, once?, execute }. */
function loadEvents(dir, client, logger) {
  let count = 0;
  for (const file of walk(dir)) {
    const event = require(file);
    if (!event.name || typeof event.execute !== 'function') {
      logger.warn(`Skipping ${path.relative(dir, file)}: needs "name" and "execute".`);
      continue;
    }
    const handler = (...args) => event.execute(client, ...args);
    if (event.once) client.once(event.name, handler);
    else client.on(event.name, handler);
    count += 1;
  }
  return count;
}

module.exports = { loadCommands, loadEvents };
