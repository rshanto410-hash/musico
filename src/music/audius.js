'use strict';

// Searches music on Audius (https://audius.co), a free open music platform.
// Its public API needs no key. Rules from Audius docs: use an app_name and credit artists
// (the bot shows the artist name and a link to the track).
// No dependencies, so it is easy to test.

const API_HOST = 'https://api.audius.co';
const APP_NAME = 'MUSICO';
const USER_AGENT = 'MUSICO-DiscordBot/0.1';

/**
 * @returns {Promise<Array<{title:string,author:string,url:string,durationMs:number,isLive:boolean,sourceLabel:string,link:string}>>}
 */
async function searchAudius(query, fetchImpl = fetch, limit = 5) {
  const params = new URLSearchParams({
    query: String(query).trim().slice(0, 100),
    app_name: APP_NAME,
  });

  const res = await fetchImpl(`${API_HOST}/v1/tracks/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Audius answered HTTP ${res.status}`);

  const body = await res.json();
  const data = Array.isArray(body?.data) ? body.data : [];

  return data
    .filter((t) => t && t.id && t.is_streamable !== false)
    .slice(0, limit)
    .map((t) => ({
      title: String(t.title || 'Unknown title').slice(0, 100),
      author: String(t.user?.name || 'Unknown artist').slice(0, 80),
      url: `${API_HOST}/v1/tracks/${encodeURIComponent(t.id)}/stream?app_name=${APP_NAME}`,
      durationMs: (Number(t.duration) || 0) * 1000,
      isLive: false,
      sourceLabel: 'Audius',
      link: t.permalink ? `https://audius.co${t.permalink}` : 'https://audius.co',
    }));
}

module.exports = { searchAudius };
