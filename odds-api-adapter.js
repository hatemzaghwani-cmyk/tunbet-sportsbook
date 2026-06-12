const https = require('https');
const URL = require('url');

const API_KEY = process.env.ODDS_API_KEY || 'c18282bc3771a4939079a7fcc2ae6b7bc8caf3811ac20506da552accef35abe0';
const BASE = 'https://api.odds-api.io/v3';

function jsonGet(url, timeout = 8000) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const timer = setTimeout(() => done(null), timeout);
    https.get(url, { headers: { 'Accept': 'application/json' }, timeout }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { clearTimeout(timer); try { done(JSON.parse(d)); } catch { done(null); } });
      res.on('error', () => { clearTimeout(timer); done(null); });
    }).on('error', () => { clearTimeout(timer); done(null); }).on('timeout', () => { clearTimeout(timer); done(null); });
  });
}

let _eventsCache = [];
let _valueBetsCache = [];
let _lastEvents = 0;
let _lastValueBets = 0;
const EVENTS_TTL = 90000;
const VALUE_TTL = 120000;

async function fetchEvents(sport = 'football') {
  if (Date.now() - _lastEvents < EVENTS_TTL && _eventsCache.length) return _eventsCache;
  const d = await jsonGet(`${BASE}/events?apiKey=${API_KEY}&sport=${sport}`);
  if (!Array.isArray(d)) return _eventsCache;
  _eventsCache = d;
  _lastEvents = Date.now();
  return d;
}

async function fetchValueBets() {
  if (Date.now() - _lastValueBets < VALUE_TTL && _valueBetsCache.length) return _valueBetsCache;
  const d = await jsonGet(`${BASE}/value-bets?apiKey=${API_KEY}&bookmaker=1xbet&includeEventDetails=true`);
  if (!Array.isArray(d)) return _valueBetsCache;
  _valueBetsCache = d;
  _lastValueBets = Date.now();
  return d;
}

function buildOddsMap(valueBets) {
  const oddsMap = {};
  for (const vb of valueBets) {
    const eid = String(vb.eventId);
    if (!oddsMap[eid]) oddsMap[eid] = {};
    const mk = vb.market?.name || 'ML';
    if (!oddsMap[eid][mk]) oddsMap[eid][mk] = {};
    const bookOdds = vb.bookmakerOdds || {};
    for (const [side, val] of Object.entries(bookOdds)) {
      if (side === 'href') continue;
      const v = parseFloat(String(val));
      if (Number.isFinite(v) && v > 1) oddsMap[eid][mk][side] = +v.toFixed(2);
    }
  }
  return oddsMap;
}

function r2(n) { return +Number(n).toFixed(2); }

function modelOdds(h, a) {
  const sd = (h.length * 31 + a.length * 17) % 9999;
  const vary = (o, seed) => r2(Math.max(1.01, Math.min(999, o * (1 + Math.sin(seed + Date.now() / 30000) * 0.015))));
  const probToOdd = (p, margin = 1.055, seed = 1) => vary(margin / Math.max(0.01, Math.min(0.95, p)), seed);
  const hPower = Math.max(0.25, 1.35 - 5 * 0.035);
  const aPower = Math.max(0.25, 1.35 - 5 * 0.035);
  const drawWeight = 0.72;
  const total = hPower + aPower + drawWeight;
  const hp = hPower / total, ap = aPower / total, dp = drawWeight / total;
  const hO = probToOdd(hp, 1.055, sd + 1);
  const aO = probToOdd(ap, 1.055, sd + 2);
  const dO = probToOdd(dp, 1.055, sd + 3);
  const goalP = Math.max(0.28, Math.min(0.78, 0.43 + Math.min(hp, ap) * 0.42));
  const bttsP = Math.max(0.22, Math.min(0.72, 0.33 + Math.min(hp, ap) / Math.max(hp, ap) * 0.25));
  const ou35 = Math.max(.12, goalP - .22);
  const ou05 = Math.min(.95, goalP + .42);
  return {
    "1X2": { "1": hO, "X": dO, "2": aO },
    "Double Chance": { "1X": probToOdd(hp + dp, 1.055, sd + 30), "12": probToOdd(hp + ap, 1.055, sd + 31), "X2": probToOdd(dp + ap, 1.055, sd + 32) },
    "Draw No Bet": { [h]: probToOdd(hp / (hp + ap), 1.055, sd + 33), [a]: probToOdd(ap / (hp + ap), 1.055, sd + 34) },
    "O/U 0.5": { "Over": probToOdd(ou05, 1.055, sd + 16), "Under": probToOdd(1 - ou05, 1.055, sd + 17) },
    "O/U 1.5": { "Over": probToOdd(Math.min(.9, goalP + .25), 1.055, sd + 22), "Under": probToOdd(Math.max(.1, 1 - goalP - .25), 1.055, sd + 23) },
    "O/U 2.5": { "Over": probToOdd(goalP, 1.055, sd + 20), "Under": probToOdd(1 - goalP, 1.055, sd + 21) },
    "O/U 3.5": { "Over": probToOdd(ou35, 1.055, sd + 24), "Under": probToOdd(1 - ou35, 1.055, sd + 25) },
    "BTTS": { "Yes": probToOdd(bttsP, 1.055, sd + 40), "No": probToOdd(1 - bttsP, 1.055, sd + 41) },
  };
}

function convertOddsApiEvent(e, oddsMap) {
  const id = String(e.id);
  const sport = e.sport?.slug || e.sport?.name?.toLowerCase() || 'football';
  const league = e.league?.name || 'League';
  const home = e.home || 'Home';
  const away = e.away || 'Away';
  const date = e.date || new Date().toISOString();
  const status = e.status === 'live' || e.status === 'inplay' || e.status === 'in_progress' ? 'live'
    : e.status === 'settled' || e.status === 'finished' ? 'finished'
    : e.status === 'cancelled' || e.status === 'postponed' ? 'cancelled'
    : 'upcoming';
  const scores = e.scores || {};
  const homeScore = Number.isFinite(scores.home) ? scores.home : undefined;
  const awayScore = Number.isFinite(scores.away) ? scores.away : undefined;
  const clock = scores.periods?.ft ? `${scores.periods.ft.home}-${scores.periods.ft.away}` : '';

  const markets = oddsMap[id] || modelOdds(home, away);

  return {
    id,
    league,
    sport: sport === 'football' ? 'football' : sport === 'basketball' ? 'basketball' : sport === 'baseball' ? 'baseball' : sport === 'hockey' ? 'ice-hockey' : sport === 'mma' ? 'mixed-martial-arts' : sport === 'tennis' ? 'tennis' : sport,
    sportName: e.sport?.name || sport,
    home,
    away,
    homeLogo: '',
    awayLogo: '',
    date,
    status,
    clock,
    homeScore,
    awayScore,
    suspended: false,
    hasRealOdds: !!oddsMap[id],
    oddsSource: oddsMap[id] ? 'Odds-API.io (1xbet)' : 'TunBet mathematical model',
    markets,
    updatedAt: new Date().toISOString(),
  };
}

async function getOddsApiMatches(sport = 'football') {
  const [events, valueBets] = await Promise.all([fetchEvents(sport), fetchValueBets()]);
  const oddsMap = buildOddsMap(valueBets);
  const all = events.filter(e => e.status !== 'cancelled' && e.status !== 'postponed').map(e => convertOddsApiEvent(e, oddsMap));
  return all;
}

module.exports = { getOddsApiMatches, fetchEvents, fetchValueBets };
