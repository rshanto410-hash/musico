'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalize,
  cleanYouTubeTitle,
  parseArtistAndTitle,
  rank,
} = require('../src/music/searchSelection');

test('cleanYouTubeTitle removes YouTube video fluff', () => {
  assert.equal(cleanYouTubeTitle('Ed Sheeran - Perfect (Official Music Video)'), 'Ed Sheeran - Perfect');
  assert.equal(cleanYouTubeTitle('Adele - Hello [Official Audio]'), 'Adele - Hello');
  assert.equal(cleanYouTubeTitle('Coldplay - Yellow (Lyrics)'), 'Coldplay - Yellow');
  assert.equal(cleanYouTubeTitle('Dua Lipa - Levitating (Official Lyric Video)'), 'Dua Lipa - Levitating');
  assert.equal(cleanYouTubeTitle('The Weeknd - Blinding Lights (Visualizer)'), 'The Weeknd - Blinding Lights');
  assert.equal(cleanYouTubeTitle('Taylor Swift - Anti-Hero (Official Music Video) | VEVO'), 'Taylor Swift - Anti-Hero');
  assert.equal(cleanYouTubeTitle('Eagles - Hotel California (Live 1977) [Official Video]'), 'Eagles - Hotel California (Live 1977)');
});

test('parseArtistAndTitle extracts artist and song title parts', () => {
  const res1 = parseArtistAndTitle('Ed Sheeran - Perfect (Official Music Video)', 'Ed Sheeran');
  assert.equal(res1.artistPart, 'Ed Sheeran');
  assert.equal(res1.titlePart, 'Perfect');

  const res2 = parseArtistAndTitle('Perfect', 'Ed Sheeran');
  assert.equal(res2.artistPart, 'Ed Sheeran');
  assert.equal(res2.titlePart, 'Perfect');

  const res3 = parseArtistAndTitle('Queen : Bohemian Rhapsody', 'Queen');
  assert.equal(res3.artistPart, 'Queen');
  assert.equal(res3.titlePart, 'Bohemian Rhapsody');
});

test('rank scores exact song title highest even without typing artist name', () => {
  const query = 'Perfect';

  const officialVideo = {
    title: 'Ed Sheeran - Perfect (Official Music Video)',
    author: 'Ed Sheeran',
  };
  const officialAudio = {
    title: 'Ed Sheeran - Perfect (Official Audio)',
    author: 'Ed Sheeran',
  };
  const lyricsVideo = {
    title: 'Ed Sheeran - Perfect (Lyrics)',
    author: 'Dan Music',
  };
  const coverSong = {
    title: 'Emma Heesters - Perfect (Cover)',
    author: 'Emma Heesters',
  };
  const remixSong = {
    title: 'Ed Sheeran - Perfect (Robin Schulz Remix)',
    author: 'Robin Schulz',
  };
  const karaokeSong = {
    title: 'Perfect - Ed Sheeran (Karaoke Version)',
    author: 'Sing King',
  };
  const unrelatedSong = {
    title: 'Luke Combs - Fast Car (Official Video)',
    author: 'Luke Combs',
  };

  const scoreOfficial = rank(officialVideo, query);
  const scoreAudio = rank(officialAudio, query);
  const scoreLyrics = rank(lyricsVideo, query);
  const scoreCover = rank(coverSong, query);
  const scoreRemix = rank(remixSong, query);
  const scoreKaraoke = rank(karaokeSong, query);
  const scoreUnrelated = rank(unrelatedSong, query);

  // Official video and audio should have highest scores
  assert.ok(scoreOfficial >= 120, `Official video score (${scoreOfficial}) should be >= 120`);
  assert.ok(scoreAudio >= 120, `Official audio score (${scoreAudio}) should be >= 120`);
  assert.ok(scoreLyrics >= 100, `Lyrics video score (${scoreLyrics}) should be >= 100`);

  // Official versions should rank strictly higher than covers and remixes
  assert.ok(scoreOfficial > scoreCover, `Official (${scoreOfficial}) must rank above Cover (${scoreCover})`);
  assert.ok(scoreOfficial > scoreRemix, `Official (${scoreOfficial}) must rank above Remix (${scoreRemix})`);
  assert.ok(scoreOfficial > scoreKaraoke, `Official (${scoreOfficial}) must rank above Karaoke (${scoreKaraoke})`);

  // Covers, remixes, and karaoke should receive heavy penalties
  assert.ok(scoreCover < 0, `Cover score (${scoreCover}) should be negative`);
  assert.ok(scoreRemix < 0, `Remix score (${scoreRemix}) should be negative`);
  assert.ok(scoreKaraoke < 0, `Karaoke score (${scoreKaraoke}) should be negative`);

  // Unrelated song should be filtered out
  assert.equal(scoreUnrelated, -999, 'Unrelated song must return -999');
});

test('sorting candidates places original recording first and filters unwanted tracks', () => {
  const query = 'Shape of You';

  const candidates = [
    { title: 'Shape of You (Nightcore Remix)', author: 'Nightcore Guy' },
    { title: 'Ed Sheeran - Shape of You (Official Music Video)', author: 'Ed Sheeran' },
    { title: 'Shape of You - Acoustic Cover by Walk off the Earth', author: 'Walk off the Earth' },
    { title: 'Ed Sheeran - Shape of You [Official Audio]', author: 'Ed Sheeran' },
    { title: 'The Chainsmokers - Closer', author: 'The Chainsmokers' },
  ];

  const sorted = candidates
    .map((item, index) => ({ item, index, score: rank(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);

  // Only the two official Ed Sheeran versions should remain after filter (> 0)
  assert.equal(sorted.length, 2);
  assert.equal(sorted[0].title, 'Ed Sheeran - Shape of You (Official Music Video)');
  assert.equal(sorted[1].title, 'Ed Sheeran - Shape of You [Official Audio]');
});

test('rank allows cover/remix if user explicitly searched for it', () => {
  const query = 'Perfect cover';
  const coverSong = {
    title: 'Emma Heesters - Perfect (Cover)',
    author: 'Emma Heesters',
  };

  const score = rank(coverSong, query);
  assert.ok(score > 0, `Explicit cover search should receive positive score (${score})`);
});
