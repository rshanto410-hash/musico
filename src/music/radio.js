'use strict';

// Finds internet radio stations using the free community Radio Browser directory
// (https://www.radio-browser.info). No account or key is needed.
// This module has no dependencies so it is easy to test.

const SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];

const USER_AGENT = 'MUSICO-DiscordBot/0.1';

// Each choice may need several spellings in the directory.
const LANGUAGES = Object.freeze({
  bangla: ['bengali', 'bangla'],
  hindi: ['hindi'],
  english: ['english'],
});

const BLOCKED_HOST = /^(localhost|.*\.local|.*\.internal)$/i;

/** Only allow public http(s) stream URLs. Rejects localhost and private IP ranges. */
function isSafeStreamUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname;
  if (BLOCKED_HOST.test(host)) return false;
  if (host === '::1' || host === '[::1]') return false;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  return true;
}

async function requestStations(params, fetchImpl) {
  const qs = new URLSearchParams({
    hidebroken: 'true',
    order: 'votes',
    reverse: 'true',
    limit: '30',
    ...params,
  });

  let lastError;
  for (const server of SERVERS) {
    try {
      const res = await fetchImpl(`${server}/json/stations/search?${qs}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Radio directory answered HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Radio directory returned unexpected data');
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Radio directory is not reachable');
}

function normalise(station) {
  const url = station.url_resolved || station.url;
  return {
    name: String(station.name || 'Unknown station').trim().slice(0, 80),
    url,
    codec: station.codec || 'unknown',
    bitrate: Number(station.bitrate) || 0,
    country: station.country || '',
  };
}

/**
 * @param {{language?: 'bangla'|'hindi'|'english'|'any', query?: string}} options
 * @returns {Promise<Array<{name:string,url:string,codec:string,bitrate:number,country:string}>>}
 */
async function searchStations({ language = 'any', query = '' } = {}, fetchImpl = fetch) {
  const cleanQuery = String(query).trim().slice(0, 50);
  const languageNames = LANGUAGES[language] || [null];

  let raw = [];
  for (const languageName of languageNames) {
    const params = {};
    if (languageName) params.language = languageName;
    if (cleanQuery) params.name = cleanQuery;
    if (!languageName && !cleanQuery) params.tag = 'pop';

    raw = await requestStations(params, fetchImpl);
    if (raw.length > 0) break;
  }

  const seen = new Set();
  const stations = [];
  for (const item of raw) {
    if (item.lastcheckok !== 1) continue;
    const station = normalise(item);
    if (!station.url || !isSafeStreamUrl(station.url)) continue;
    if (seen.has(station.url)) continue;
    seen.add(station.url);
    stations.push(station);
  }
  return stations;
}

module.exports = { searchStations, isSafeStreamUrl, LANGUAGES };
