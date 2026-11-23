'use strict';

// Searches free, legal Creative Commons music on Jamendo (https://www.jamendo.com).
// Needs a free Client ID from https://devportal.jamendo.com (set JAMENDO_CLIENT_ID).
// Jamendo's terms: free for non-commercial use; credit the artist and link to the track.
// This module has no dependencies so it is easy to test.

const API_URL = 'https://api.jamendo.com/v3.0/tracks/';
const USER_AGENT = 'MUSICO-DiscordBot/0.1';

/**
 * @returns {Promise<Array<{title:string,author:string,url:string,durationMs:number,isLive:boolean,sourceLabel:string,link:string}>>}
 */
async function searchJamendo(query, clientId, fetchImpl = fetch, limit = 5) {
  if (!clientId) throw new Error('JAMENDO_NOT_CONFIGURED');

  const params = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: String(limit),
    search: String(query).trim().slice(0, 100),
  });

  const res = await fetchImpl(`${API_URL}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Jamendo answered HTTP ${res.status}`);

  const body = await res.json();
  const status = body?.headers?.status;
  if (status && status !== 'success') {
    throw new Error(`Jamendo error: ${body.headers.error_message || status}`);
  }

  return (Array.isArray(body?.results) ? body.results : [])
    .filter((track) => track && track.audio)
    .map((track) => ({
      title: String(track.name || 'Unknown title').slice(0, 100),
      author: String(track.artist_name || 'Unknown artist').slice(0, 80),
      url: track.audio,
      durationMs: (Number(track.duration) || 0) * 1000,
      isLive: false,
      sourceLabel: 'Jamendo',
      link: `https://www.jamendo.com/track/${encodeURIComponent(track.id)}`,
    }));
}

module.exports = { searchJamendo };
