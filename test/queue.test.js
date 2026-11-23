'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GuildQueue } = require('../src/music/queue');

test('GuildQueue initializes with correct defaults', () => {
  const queue = new GuildQueue('123456789');
  assert.equal(queue.guildId, '123456789');
  assert.equal(queue.current, null);
  assert.deepEqual(queue.upcoming, []);
  assert.deepEqual(queue.history, []);
  assert.equal(queue.loop, 'off');
  assert.equal(queue.paused, false);
  assert.equal(queue.isActive, false);
});

test('GuildQueue add, next, and history behavior', () => {
  const queue = new GuildQueue('123456789');
  const song1 = { title: 'Song 1', author: 'Artist 1' };
  const song2 = { title: 'Song 2', author: 'Artist 2' };

  queue.add(song1);
  queue.add(song2);
  assert.equal(queue.upcoming.length, 2);

  // Next song 1
  const current1 = queue.next();
  assert.equal(current1, song1);
  assert.equal(queue.current, song1);
  assert.equal(queue.upcoming.length, 1);
  assert.equal(queue.isActive, true);

  // Next song 2
  const current2 = queue.next();
  assert.equal(current2, song2);
  assert.equal(queue.current, song2);
  assert.equal(queue.upcoming.length, 0);
  assert.deepEqual(queue.history, [song1]);

  // Queue ends
  const end = queue.next();
  assert.equal(end, null);
  assert.equal(queue.current, null);
  assert.equal(queue.isActive, false);
});

test('GuildQueue previous navigates backwards', () => {
  const queue = new GuildQueue('123456789');
  const song1 = { title: 'Song 1', author: 'Artist 1' };
  const song2 = { title: 'Song 2', author: 'Artist 2' };

  queue.add(song1);
  queue.add(song2);
  queue.next(); // Song 1
  queue.next(); // Song 2 (Song 1 moved to history)

  const prev = queue.previous();
  assert.equal(prev, song1);
  assert.equal(queue.current, song1);
  assert.equal(queue.upcoming[0], song2);
});

test('GuildQueue loop modes: track and queue', () => {
  const queue = new GuildQueue('123456789');
  const song1 = { title: 'Song 1', author: 'Artist 1' };
  const song2 = { title: 'Song 2', author: 'Artist 2' };

  queue.add(song1);
  queue.add(song2);
  queue.next(); // Current = song1, upcoming = [song2]

  // Loop track
  queue.loop = 'track';
  assert.equal(queue.next(), song1, 'Loop track should keep repeating current track');
  assert.equal(queue.next(true), song2, 'Force next (skip) should bypass track loop and move to song2');

  // Loop queue: now current is song2, upcoming is []
  queue.loop = 'queue';
  // When next() is called: song2 is re-enqueued to upcoming, and since upcoming was empty, song2 is shifted
  assert.equal(queue.next(), song2, 'Queue loop re-enqueues song2');

  // Now test with two songs in queue loop
  const queue2 = new GuildQueue('987654321');
  queue2.loop = 'queue';
  queue2.add(song1);
  queue2.add(song2);
  assert.equal(queue2.next(), song1); // current=song1, upcoming=[song2]
  assert.equal(queue2.next(), song2); // song1 re-enqueued, current=song2, upcoming=[song1]
  assert.equal(queue2.next(), song1); // song2 re-enqueued, current=song1, upcoming=[song2]
});

test('GuildQueue clear resets all state including paused', () => {
  const queue = new GuildQueue('123456789');
  queue.add({ title: 'Song 1' });
  queue.next();
  queue.paused = true;

  queue.clear();
  assert.equal(queue.current, null);
  assert.deepEqual(queue.upcoming, []);
  assert.deepEqual(queue.history, []);
  assert.equal(queue.paused, false, 'clear() must reset paused to false');
  assert.equal(queue.isActive, false);
});
