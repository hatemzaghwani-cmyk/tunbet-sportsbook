const http = require('http');
const https = require('https');
const cron = require('node-cron');
const crypto = require('crypto');
const { fork } = require('child_process');

const PORT = process.env.PORT || 4000;
const SU = process.env.SUPA_URL || process.env.SUPABASE_URL || "https://cjzjrnagpsdmolvbkhnu.supabase.co";
const SK = process.env.SUPA_KEY || process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqempybmFncHNkbW9sdmJraG51Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDM0ODY4NCwiZXhwIjoyMDk1OTI0Njg0fQ.TmowEatc4g2xpD-GT0r-jofX1zCtXjTD-s4LF7JSs6o";
const ORO_API = "https://und7br.sxvwlkohlv.com/api/v2";
const ORO_CLIENT_ID = process.env.ORO_CLIENT_ID || "Hatem1_TND";
const ORO_CLIENT_SECRET = process.env.ORO_CLIENT_SECRET || "JdYysA2TS7K3xzIYJoOlRn2z9i9XWk57";
const ORO_SEAMLESS_SECRET = process.env.ORO_SEAMLESS_SECRET || "tunbet_seamless_2026";

process.env.SUPABASE_URL = process.env.SUPABASE_URL || SU;
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || SK;
process.env.SUPA_URL = process.env.SUPA_URL || SU;
process.env.SUPA_KEY = process.env.SUPA_KEY || SK;

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const LG = [
  { s: "soccer", id: "eng.1", n: "Premier League" },
  { s: "soccer", id: "esp.1", n: "La Liga" },
  { s: "soccer", id: "ger.1", n: "Bundesliga" },
  { s: "soccer", id: "ita.1", n: "Serie A" },
  { s: "soccer", id: "fra.1", n: "Ligue 1" },
  { s: "soccer", id: "uefa.champions", n: "Champions League" },
  { s: "soccer", id: "usa.1", n: "MLS" },
  { s: "soccer", id: "bra.1", n: "Brasileirão" },
  { s: "soccer", id: "tur.1", n: "Süper Lig" },
  { s: "soccer", id: "por.1", n: "Liga Portugal" },
  { s: "soccer", id: "fifa.worldq.conmebol", n: "WCQ CONMEBOL" },
  { s: "soccer", id: "fifa.worldq.uefa", n: "WCQ UEFA" },
  { s: "basketball", id: "nba", n: "NBA" },
  { s: "basketball", id: "wnba", n: "WNBA" },
  { s: "football", id: "nfl", n: "NFL" },
  { s: "baseball", id: "mlb", n: "MLB" },
  { s: "hockey", id: "nhl", n: "NHL" },
  { s: "mma", id: "ufc", n: "UFC" },
  { s: "tennis", id: "atp", n: "ATP" },
  { s: "tennis", id: "wta", n: "WTA" },
];
const IC = { soccer: "⚽", basketball: "🏀", football: "🏈", baseball: "⚾", hockey: "🏒", mma: "🥊", tennis: "🎾" };
const SPORT_SLUG = { soccer: "football", basketball: "basketball", football: "american-football", baseball: "baseball", hockey: "ice-hockey", mma: "mixed-martial-arts", tennis: "tennis" };
const SPORT_NAME = { soccer: "Soccer", basketball: "Basketball", football: "NFL", baseball: "MLB", hockey: "NHL", mma: "UFC", tennis: "Tennis" };

function jsonGet(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'TunBet/8.0', 'Accept': 'application/json' }, timeout: 12000 }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

function supa(method, path, body, prefer = 'return=representation') {
  return new Promise((resolve, reject) => {
    const u = new URL(SU + '/rest/v1' + path);
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers = {
      apikey: SK,
      Authorization: 'Bearer ' + SK,
      'Content-Type': 'application/json',
      Prefer: prefer,
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers, timeout: 15000 }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let parsed = d;
        try { parsed = d ? JSON.parse(d) : null; } catch {}
        if (res.statusCode >= 400) {
          const msg = (parsed && (parsed.message || parsed.error || parsed.details)) || d || `Supabase ${res.statusCode}`;
          reject(new Error(msg));
        } else {
          resolve(parsed);
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Supabase timeout')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!body) return resolve({});
      try { return resolve(JSON.parse(body)); }
      catch {
        try {
          const params = {};
          body.split('&').forEach(p => {
            if (!p) return;
            const [k, v = ''] = p.split('=');
            params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
          });
          return resolve(params);
        } catch { return resolve({}); }
      }
    });
    req.on('error', () => resolve({}));
  });
}

async function updateBalance(userId, action, amount) {
  const out = await supa('POST', '/rpc/update_balance', { p_user_id: Number(userId), p_action: action, p_amount: Number(amount) });
  const n = Number(out);
  if (!Number.isFinite(n)) throw new Error('Balance update failed');
  return +n.toFixed(2);
}

async function getBalance(username) {
  if (!username || typeof username !== 'string') return { success: false, error: "Missing username" };
  const userId = username.replace('tb_', '').trim();
  if (!userId || isNaN(userId)) return { success: false, error: "Invalid user: " + username };
  const users = await supa('GET', `/users?id=eq.${encodeURIComponent(userId)}&select=balance`);
  if (!Array.isArray(users) || !users.length) return { success: false, error: "User not found", userId };
  const balance = parseFloat(users[0].balance || 0);
  return { success: true, balance, userId };
}

async function deduct(username, amount, txId, gameCode) {
  if (!username || typeof username !== 'string') return { success: false, error: "Missing username" };
  const userId = username.replace('tb_', '').trim();
  amount = Math.round(Number(amount) * 100) / 100;
  if (!userId || isNaN(userId)) return { success: false, error: "Invalid user" };
  if (!amount || amount <= 0) return { success: false, error: "Invalid amount" };
  const beforeRows = await supa('GET', `/users?id=eq.${encodeURIComponent(userId)}&select=balance`);
  const before = parseFloat(beforeRows?.[0]?.balance || 0);
  try {
    const newBal = await updateBalance(Number(userId), 'withdraw', amount);
    await supa('POST', '/transactions', {
      user_id: Number(userId), type: 'oro_bet', amount: -amount,
      balance_before: before, balance_after: newBal,
      description: `OroPlay bet: ${gameCode || 'unknown'} tx:${txId || 'none'}`,
    }).catch(() => {});
    return { success: true, balance: newBal, txId };
  } catch (e) {
    return { success: false, error: e.message || "Insufficient balance", balance: before };
  }
}

async function credit(username, amount, txId, gameCode) {
  if (!username || typeof username !== 'string') return { success: false, error: "Missing username" };
  const userId = username.replace('tb_', '').trim();
  amount = Math.round(Number(amount) * 100) / 100;
  if (!userId || isNaN(userId)) return { success: false, error: "Invalid user" };
  if (!amount || amount <= 0) return { success: false, error: "Invalid amount" };
  const beforeRows = await supa('GET', `/users?id=eq.${encodeURIComponent(userId)}&select=balance`);
  const before = parseFloat(beforeRows?.[0]?.balance || 0);
  try {
    const newBal = await updateBalance(Number(userId), 'add', amount);
    await supa('POST', '/transactions', {
      user_id: Number(userId), type: 'oro_win', amount,
      balance_before: before, balance_after: newBal,
      description: `OroPlay win: ${gameCode || 'unknown'} tx:${txId || 'none'}`,
    }).catch(() => {});
    return { success: true, balance: newBal, txId };
  } catch (e) {
    return { success: false, error: e.message || "Credit failed" };
  }
}

let oroToken = null, oroExp = 0;
async function getOroToken() {
  if (oroToken && Date.now() < oroExp) return oroToken;
  return new Promise((resolve, reject) => {
    const d = JSON.stringify({ clientId: ORO_CLIENT_ID, clientSecret: ORO_CLIENT_SECRET });
    const u = new URL(ORO_API + '/auth/createtoken');
    const r = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } }, (s) => {
      let b = '';
      s.on('data', c => b += c);
      s.on('end', () => {
        try {
          const j = JSON.parse(b);
          if (j.token) { oroToken = j.token; oroExp = Date.now() + (j.expiration || 3600) * 1000; }
          resolve(j.token || j);
        } catch (e) { reject(e); }
      });
    });
    r.on('error', reject); r.write(d); r.end();
  });
}

async function oroApiCall(path, method, body) {
  const token = await getOroToken();
  return new Promise((resolve, reject) => {
    const d = JSON.stringify(body || {});
    const u = new URL(ORO_API + path);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d), 'Authorization': 'Bearer ' + token } }, (s) => {
      let b = '';
      s.on('data', c => b += c);
      s.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    });
    r.on('error', reject); r.write(d); r.end();
  });
}
async function oroCreateUser(userCode) { try { return await oroApiCall('/user/create', 'POST', { userCode }); } catch (e) { return { success: false, error: e.message }; } }
async function oroLaunchGame(userCode, gameCode, vendorCode = 'slot-amatic', language = 'en') { await oroCreateUser(userCode); return oroApiCall('/game/launch-url', 'POST', { vendorCode, gameCode, userCode, language, lobbyUrl: 'https://tunbet.surge.sh' }); }

function americanToDecimal(v) {
  if (v === undefined || v === null || v === '' || v === 'OFF') return 0;
  if (typeof v === 'object') v = v.american || v.odds || v.value || v.decimal;
  const raw = String(v).replace(/[+,]/g, '').trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return 0;
  if (n > 1 && n < 100 && String(v).includes('.')) return +n.toFixed(2);
  return n > 0 ? +(n / 100 + 1).toFixed(2) : +(100 / Math.abs(n) + 1).toFixed(2);
}
function vary(o, seed) { return +(Math.max(1.01, Math.min(999, o * (1 + Math.sin(seed + Date.now() / 30000) * 0.015))).toFixed(2)); }
function probToOdd(p, margin = 1.055, seed = 1) { return vary(margin / Math.max(0.01, Math.min(0.95, p)), seed); }
function closeOdd(od, market, side) { return americanToDecimal(od?.[market]?.[side]?.close?.odds || od?.[market]?.[side]?.open?.odds); }
function closeLine(od, market, side, fallback = '') { return od?.[market]?.[side]?.close?.line || od?.[market]?.[side]?.open?.line || fallback; }
function cleanLine(x, fallback = '') { const s = String(x || '').replace(/^o/i, '').replace(/^u/i, ''); return (s && s !== 'OFF') ? s : fallback; }
function signedLine(x, fallback = '') {
  const s = String(x || fallback || '').trim();
  if (!s || s === 'OFF') return fallback;
  const n = Number(s);
  if (Number.isFinite(n)) return n > 0 ? `+${n}` : String(n);
  return s;
}
function pickEspnOdds(list) {
  if (!Array.isArray(list)) return null;
  return list.find(o => /draft\s*kings?/i.test(o?.provider?.name || o?.provider?.displayName || '')) || list.find(Boolean) || null;
}
function oddsProviderName(od) { return od?.provider?.displayName || od?.provider?.name || (od ? 'ESPN Odds' : 'TunBet Model'); }
function hasUsableOdds(od) { return !!(od && (od.moneyline || od.pointSpread || od.total || od.overUnder || od.details)); }

function mkts(sp, h, a, od, hR, aR) {
  const M = 1.055, sd = (h.length * 31 + a.length * 17 + String(sp).length * 13) % 9999;
  const rankH = Number.isFinite(hR) ? hR : 5, rankA = Number.isFinite(aR) ? aR : 5;
  const hPower = Math.max(0.25, 1.35 - rankH * 0.035);
  const aPower = Math.max(0.25, 1.35 - rankA * 0.035);
  const drawWeight = sp === 'soccer' ? 0.72 : sp === 'hockey' ? 0.18 : 0.02;
  const totalPower = hPower + aPower + drawWeight;
  const hp0 = hPower / totalPower, ap0 = aPower / totalPower, dp0 = drawWeight / totalPower;
  let hO = closeOdd(od, 'moneyline', 'home') || americanToDecimal(od?.homeTeamOdds?.moneyLine) || probToOdd(hp0, M, sd + 1);
  let aO = closeOdd(od, 'moneyline', 'away') || americanToDecimal(od?.awayTeamOdds?.moneyLine) || probToOdd(ap0, M, sd + 2);
  let dO = closeOdd(od, 'moneyline', 'draw') || americanToDecimal(od?.drawOdds?.moneyLine) || probToOdd(dp0, M, sd + 3);
  hO = vary(hO, sd + 10); aO = vary(aO, sd + 11); dO = vary(dO || 3.25, sd + 12);
  const hp = 1 / hO, ap = 1 / aO, dp = sp === 'soccer' ? 1 / dO : 0;
  const goalP = Math.max(0.28, Math.min(0.78, 0.43 + Math.min(hp, ap) * 0.42));
  const bttsP = Math.max(0.22, Math.min(0.72, 0.33 + Math.min(hp, ap) / Math.max(hp, ap) * 0.25));

  if (sp === 'soccer') {
    return {
      "1X2": { "1": hO, "X": dO, "2": aO },
      "O/U 2.5": { "Over": probToOdd(goalP, M, sd + 20), "Under": probToOdd(1 - goalP, M, sd + 21) },
      "O/U 1.5": { "Over": probToOdd(Math.min(.9, goalP + .25), M, sd + 22), "Under": probToOdd(Math.max(.1, 1 - goalP - .25), M, sd + 23) },
      "DC": { "1X": probToOdd(hp + dp, M, sd + 30), "12": probToOdd(hp + ap, M, sd + 31), "X2": probToOdd(dp + ap, M, sd + 32) },
      "BTTS": { "GG": probToOdd(bttsP, M, sd + 40), "NG": probToOdd(1 - bttsP, M, sd + 41) },
      "CS": { "1-0": vary(7.2 / Math.max(hp, .15), sd + 50), "0-0": vary(7.8, sd + 51), "0-1": vary(7.2 / Math.max(ap, .15), sd + 52), "2-1": vary(9 / Math.max(hp, .15), sd + 53), "1-1": vary(5.5, sd + 54) },
      "HT": { "1": vary(hO * 1.35, sd + 60), "X": vary(dO * .78, sd + 61), "2": vary(aO * 1.35, sd + 62) },
    };
  }

  if (sp === 'basketball' || sp === 'football') {
    const totalFallback = sp === 'basketball' ? 215.5 : 44.5;
    const spreadFallback = hp > ap ? -3.5 : 3.5;
    const hLine = signedLine(closeLine(od, 'pointSpread', 'home', String(spreadFallback)), String(spreadFallback));
    const aLine = signedLine(closeLine(od, 'pointSpread', 'away', String(-Number(spreadFallback))), String(-Number(spreadFallback)));
    const totalLine = cleanLine(closeLine(od, 'total', 'over', String(od?.overUnder || totalFallback)), String(od?.overUnder || totalFallback));
    return {
      "ML": { [h]: hO, [a]: aO },
      "Spread": { [`${h} ${hLine}`]: closeOdd(od, 'pointSpread', 'home') || vary(1.91, sd + 30), [`${a} ${aLine}`]: closeOdd(od, 'pointSpread', 'away') || vary(1.91, sd + 31) },
      "Total": { [`O ${totalLine}`]: closeOdd(od, 'total', 'over') || vary(1.91, sd + 40), [`U ${totalLine}`]: closeOdd(od, 'total', 'under') || vary(1.91, sd + 41) },
    };
  }

  if (sp === 'baseball') {
    const totalLine = cleanLine(closeLine(od, 'total', 'over', String(od?.overUnder || 8.5)), String(od?.overUnder || 8.5));
    const hRL = signedLine(closeLine(od, 'pointSpread', 'home', '+1.5'), '+1.5');
    const aRL = signedLine(closeLine(od, 'pointSpread', 'away', '-1.5'), '-1.5');
    return {
      "ML": { [h]: hO, [a]: aO },
      "Run Line": { [`${h} ${hRL === 'OFF' ? '+1.5' : hRL}`]: closeOdd(od, 'pointSpread', 'home') || probToOdd(hp * .48, M, sd + 30), [`${a} ${aRL === 'OFF' ? '-1.5' : aRL}`]: closeOdd(od, 'pointSpread', 'away') || probToOdd(ap * .48, M, sd + 31) },
      "Total": { [`O ${totalLine}`]: closeOdd(od, 'total', 'over') || vary(1.91, sd + 40), [`U ${totalLine}`]: closeOdd(od, 'total', 'under') || vary(1.91, sd + 41) },
    };
  }

  if (sp === 'hockey') {
    const totalLine = cleanLine(closeLine(od, 'total', 'over', String(od?.overUnder || 5.5)), String(od?.overUnder || 5.5));
    const hPL = signedLine(closeLine(od, 'pointSpread', 'home', '+1.5'), '+1.5');
    const aPL = signedLine(closeLine(od, 'pointSpread', 'away', '-1.5'), '-1.5');
    return {
      "ML": { [h]: hO, [a]: aO },
      "Puck Line": { [`${h} ${hPL}`]: closeOdd(od, 'pointSpread', 'home') || probToOdd(hp * .45, M, sd + 30), [`${a} ${aPL}`]: closeOdd(od, 'pointSpread', 'away') || probToOdd(ap * .45, M, sd + 31) },
      "Total": { [`O ${totalLine}`]: closeOdd(od, 'total', 'over') || vary(1.91, sd + 40), [`U ${totalLine}`]: closeOdd(od, 'total', 'under') || vary(1.91, sd + 41) },
    };
  }

  if (sp === 'mma') return { "Winner": { [h]: hO, [a]: aO }, "Method": { "KO/TKO": vary(2.8, sd + 30), "Submission": vary(4.2, sd + 31), "Decision": vary(2.4, sd + 32) }, "Rounds": { "O 2.5": vary(1.85, sd + 40), "U 2.5": vary(1.95, sd + 41) } };
  if (sp === 'tennis') return { "Winner": { [h]: hO, [a]: aO }, "Sets": { "O 2.5": vary(2.1, sd + 30), "U 2.5": vary(1.75, sd + 31) } };
  return { "Winner": { [h]: hO, [a]: aO } };
}

let cache = [], prevSc = {}, lastT = 0, suspended = {}, feedPromise = null;
function ymd(ts) { return new Date(ts).toISOString().slice(0, 10).replace(/-/g, ''); }
function dateRange() { return `${ymd(Date.now() - 2 * 86400_000)}-${ymd(Date.now() + 21 * 86400_000)}`; }
function statusFromEspn(e) {
  const st = e.status?.type?.name || '';
  const live = /PROGRESS|HALFTIME|IN_PROGRESS|STATUS_PLAYING|STATUS_HALFTIME/i.test(st);
  const fin = /FINAL|FULL_TIME|STATUS_FINAL|STATUS_FULL_TIME/i.test(st);
  return fin ? 'finished' : live ? 'live' : 'upcoming';
}

async function feed() {
  if (feedPromise) return feedPromise;
  feedPromise = (async () => {
    console.log(`[${new Date().toISOString()}] ESPN feed refresh...`);
    const all = [];
    const range = dateRange();
    for (const l of LG) {
      try {
        const d = await jsonGet(`${ESPN}/${l.s}/${l.id}/scoreboard?dates=${range}&limit=60`);
        if (!d?.events) continue;
        for (const e of d.events) {
          const c = e.competitions?.[0]; if (!c) continue;
          const ts = c.competitors || [];
          const h = ts.find(t => t.homeAway === 'home') || ts[0];
          const a = ts.find(t => t.homeAway === 'away') || ts[1];
          if (!h?.team || !a?.team) continue;
          const status = statusFromEspn(e);
          const hS = Number(h.score || 0), aS = Number(a.score || 0), id = String(e.id);
          const prev = prevSc[id];
          const scoreChanged = prev && (prev.h !== hS || prev.a !== aS);
          prevSc[id] = { h: hS, a: aS, settled: prev?.settled || false };
          if (status === 'live' && scoreChanged) suspended[id] = Date.now();
          const isSusp = !!(suspended[id] && Date.now() - suspended[id] < 30000);
          const od = pickEspnOdds(c.odds);
          const hR = Number(h.curatedRank?.current || h.order || 5), aR = Number(a.curatedRank?.current || a.order || 5);
          const homeName = h.team.shortDisplayName || h.team.displayName;
          const awayName = a.team.shortDisplayName || a.team.displayName;
          const markets = (status !== 'finished' && !isSusp) ? mkts(l.s, homeName, awayName, od, hR, aR) : {};
          const realOdds = hasUsableOdds(od);
          all.push({
            id,
            league: `${IC[l.s] || '🏅'} ${l.n}`,
            sport: SPORT_SLUG[l.s] || l.s,
            espnSport: l.s,
            sportName: SPORT_NAME[l.s] || l.s,
            home: h.team.displayName,
            away: a.team.displayName,
            homeLogo: h.team.logo || '',
            awayLogo: a.team.logo || '',
            date: e.date,
            status,
            clock: e.status?.displayClock || '',
            period: e.status?.type?.shortDetail || e.status?.type?.detail || '',
            homeScore: hS,
            awayScore: aS,
            suspended: isSusp,
            hasRealOdds: realOdds,
            oddsSource: realOdds ? `ESPN ${oddsProviderName(od)}` : 'TunBet mathematical model',
            markets,
            updatedAt: new Date().toISOString(),
          });
          if (status === 'finished' && prev && !prev.settled) {
            prevSc[id].settled = true;
            settleBets(id, hS, aS, l.s).catch(e => console.error('settle', id, e.message));
          }
        }
      } catch (e) { console.error(l.n, e.message); }
    }
    all.sort((a, b) => (a.status === 'live' ? 0 : a.status === 'upcoming' ? 1 : 2) - (b.status === 'live' ? 0 : b.status === 'upcoming' ? 1 : 2) || new Date(a.date) - new Date(b.date));
    cache = all;
    lastT = Date.now();
    console.log(`✓ ESPN feed: ${cache.length} events (${cache.filter(m => m.status === 'live').length} live, ${cache.filter(m => m.status === 'upcoming').length} upcoming)`);
  })().finally(() => { feedPromise = null; });
  return feedPromise;
}

function normalizeEventId(eventId) { return String(eventId || '').replace(/^espn_/, ''); }
function marketOfBet(b) { return b.market || b.sport || ''; }
function selectionWon(market, sel, hS, aS, homeName, awayName) {
  if (market === '1X2') return (sel === '1' && hS > aS) || (sel === 'X' && hS === aS) || (sel === '2' && hS < aS);
  if (market === 'O/U 2.5') return (sel === 'Over' && hS + aS > 2.5) || (sel === 'Under' && hS + aS < 2.5);
  if (market === 'O/U 1.5') return (sel === 'Over' && hS + aS > 1.5) || (sel === 'Under' && hS + aS < 1.5);
  if (market === 'BTTS') return (['GG', 'Yes'].includes(sel) && hS > 0 && aS > 0) || (['NG', 'No'].includes(sel) && (hS === 0 || aS === 0));
  if (market === 'DC' || market === 'Double Chance') return (sel === '1X' && hS >= aS) || (sel === '12' && hS !== aS) || (sel === 'X2' && hS <= aS);
  if (market === 'ML' || market === 'Winner') return (sel === homeName || sel.includes(homeName.substring(0, 8))) ? hS > aS : hS < aS;
  return false;
}
async function settleBets(eventId, hS, aS) {
  const bets = await supa('GET', `/sports_bets?event_id=eq.${encodeURIComponent(eventId)}&status=eq.pending&select=*`);
  if (!Array.isArray(bets) || !bets.length) return;
  const m = cache.find(x => x.id === String(eventId));
  const homeName = m?.home || '', awayName = m?.away || '';
  for (const b of bets) {
    const status = selectionWon(marketOfBet(b), b.selection, hS, aS, homeName, awayName) ? 'won' : 'lost';
    const updated = await supa('PATCH', `/sports_bets?id=eq.${b.id}&status=eq.pending`, { status, settled_at: new Date().toISOString(), payout: status === 'won' ? b.potential_win : 0 });
    if (!Array.isArray(updated) || !updated.length) continue;
    if (status === 'won') {
      const beforeRows = await supa('GET', `/users?id=eq.${b.user_id}&select=balance`);
      const before = parseFloat(beforeRows?.[0]?.balance || 0);
      const payout = Number(b.potential_win || 0);
      const after = await updateBalance(b.user_id, 'add', payout);
      await supa('POST', '/transactions', { user_id: b.user_id, type: 'win', amount: payout, balance_before: before, balance_after: after, description: `Won: ${b.event_name}` }).catch(() => {});
    }
  }
}

function validatePick(pick) {
  const eventId = normalizeEventId(pick.eventId);
  const m = cache.find(x => x.id === eventId);
  if (!m) return { error: 'Match not found' };
  if (m.status === 'finished') return { error: 'Match finished' };
  if (m.status !== 'live' && new Date(m.date).getTime() < Date.now() - 10 * 60_000) return { error: 'Match already started' };
  if (m.suspended) return { error: 'Markets suspended after score change' };
  if (!m.markets || Object.keys(m.markets).length === 0) return { error: 'Markets closed' };
  const market = String(pick.market || '');
  const selection = String(pick.selection || '');
  const mkt = m.markets[market];
  if (!mkt) return { error: 'Market not found' };
  const serverOdds = Number(mkt[selection]);
  if (!serverOdds || serverOdds < 1.01) return { error: 'Selection not found' };
  const clientOdds = Number(pick.odds || 0);
  if (clientOdds && Math.abs(serverOdds - clientOdds) / serverOdds > 0.02) return { error: 'Odds changed', currentOdds: serverOdds };
  return { ok: true, match: m, eventId, market, selection, odds: +serverOdds.toFixed(2) };
}

async function ensureFreshForBet(picks) {
  if (!cache.length || Date.now() - lastT > 45_000) await feed();
  let checked = picks.map(validatePick);
  const bad = checked.find(x => x.error);
  if (bad) return bad;
  if (checked.some(x => x.match.status === 'live')) {
    await new Promise(r => setTimeout(r, 5000));
    await feed();
    checked = picks.map(validatePick);
    const bad2 = checked.find(x => x.error);
    if (bad2) return bad2;
  }
  return { ok: true, picks: checked };
}

async function placeBet(userId, eventId, market, selection, odds, stake) {
  const out = await placeBetBatch(userId, [{ eventId, market, selection, odds }], stake);
  if (out.error) return out;
  return { success: true, odds: out.bets?.[0]?.odds, potentialWin: out.bets?.[0]?.potential_win, newBalance: out.newBalance };
}

async function placeBetBatch(userId, picks, stake) {
  userId = Number(userId); stake = Math.round(Number(stake) * 100) / 100;
  if (!userId) return { error: 'Unauthorized' };
  if (!Array.isArray(picks) || !picks.length) return { error: 'No selections' };
  if (!stake || stake < 0.5) return { error: 'Min bet 0.50 TND' };
  if (stake > 5000) return { error: 'Max bet 5000 TND' };
  if (picks.length > 20) return { error: 'Max 20 selections' };
  const uniqueEvents = new Set(picks.map(p => normalizeEventId(p.eventId)));
  if (uniqueEvents.size !== picks.length) return { error: 'Only one selection per match' };

  const verified = await ensureFreshForBet(picks);
  if (verified.error) return verified;
  const selections = verified.picks;
  const totalStake = +(stake * selections.length).toFixed(2);
  const users = await supa('GET', `/users?id=eq.${userId}&select=balance`);
  if (!Array.isArray(users) || !users.length) return { error: 'User not found' };
  const bal = Number(users[0].balance || 0);
  if (bal < totalStake) return { error: 'Insufficient balance', balance: bal };

  let newBalance;
  try { newBalance = await updateBalance(userId, 'withdraw', totalStake); }
  catch (e) { return { error: e.message || 'Insufficient balance', balance: bal }; }

  const rows = selections.map(v => ({
    user_id: userId,
    event_id: v.eventId,
    event_name: `${v.match.home} vs ${v.match.away}`.slice(0, 250),
    sport: v.market,
    league: v.match.league,
    selection: v.selection,
    selection_name: `${v.market}: ${v.selection}`.slice(0, 250),
    odds: v.odds,
    stake,
    potential_win: +(stake * v.odds).toFixed(2),
    status: 'pending',
  }));

  try {
    const inserted = await supa('POST', '/sports_bets', rows);
    await supa('POST', '/transactions', {
      user_id: userId, type: 'bet', amount: -totalStake,
      balance_before: bal, balance_after: newBalance,
      description: rows.length === 1 ? `${rows[0].event_name} | ${rows[0].selection_name}` : `Sportsbook ${rows.length} selections`,
    }).catch(() => {});
    return { success: true, count: rows.length, totalStake, newBalance, bets: Array.isArray(inserted) ? inserted : rows };
  } catch (e) {
    await updateBalance(userId, 'add', totalStake).catch(() => {});
    return { error: 'Failed to record bet — stake refunded' };
  }
}


// ═══════════════════════════════════════════════════════
// Slotopol API adapter (347 games list in frontend)
// Real balance is kept in Supabase; every spin is atomic withdraw + optional credit.
// If a dedicated Slotopol Go service is deployed later, this adapter can proxy it via SLOTOPOL_URL.
// ═══════════════════════════════════════════════════════

const SLOTOPOL_SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7', 'BAR', 'WILD', 'SCAT'];
const SLOTOPOL_WEIGHTED = ['🍒','🍒','🍒','🍋','🍋','🍋','🔔','🔔','⭐','⭐','💎','7','BAR','WILD','SCAT'];
const SLOTOPOL_PAY = {
  '🍒': { 3: 0.5, 4: 1.5, 5: 5 },
  '🍋': { 3: 0.6, 4: 1.8, 5: 6 },
  '🔔': { 3: 0.8, 4: 2.5, 5: 8 },
  '⭐': { 3: 1.0, 4: 3.0, 5: 12 },
  '💎': { 3: 1.5, 4: 5.0, 5: 20 },
  '7': { 3: 2.0, 4: 8.0, 5: 35 },
  'BAR': { 3: 2.5, 4: 10.0, 5: 50 },
  'WILD': { 3: 3.0, 4: 12.0, 5: 75 },
};
const SLOTOPOL_LINES = [
  { name: 'Top', rows: [0,0,0,0,0] },
  { name: 'Middle', rows: [1,1,1,1,1] },
  { name: 'Bottom', rows: [2,2,2,2,2] },
  { name: 'V', rows: [0,1,2,1,0] },
  { name: 'Λ', rows: [2,1,0,1,2] },
];

function slotopolPick() {
  return SLOTOPOL_WEIGHTED[crypto.randomInt(SLOTOPOL_WEIGHTED.length)];
}
function slotopolReels() {
  return Array.from({ length: 3 }, () => Array.from({ length: 5 }, () => slotopolPick()));
}
function slotopolLineWin(reels, rows, stakePerLine) {
  const seq = rows.map((r, c) => reels[r][c]);
  const base = seq.find(x => x !== 'WILD') || 'WILD';
  let count = 0;
  for (const sym of seq) {
    if (sym === base || sym === 'WILD') count++;
    else break;
  }
  if (count < 3 || base === 'SCAT') return null;
  const mult = (SLOTOPOL_PAY[base] || SLOTOPOL_PAY['🍒'])[count] || 0;
  if (!mult) return null;
  return { symbol: base, count, mult, amount: +(stakePerLine * mult).toFixed(2) };
}
function slotopolEvaluate(reels, stake) {
  const stakePerLine = Math.max(0.01, stake / SLOTOPOL_LINES.length);
  const wins = [];
  let total = 0;
  for (const line of SLOTOPOL_LINES) {
    const hit = slotopolLineWin(reels, line.rows, stakePerLine);
    if (hit) {
      wins.push({ line: line.name, ...hit });
      total += hit.amount;
    }
  }
  const scatters = reels.flat().filter(x => x === 'SCAT').length;
  if (scatters >= 3) {
    const mult = scatters === 3 ? 2 : scatters === 4 ? 8 : 25;
    const amount = +(stake * mult).toFixed(2);
    wins.push({ line: 'Scatter', symbol: 'SCAT', count: scatters, mult, amount });
    total += amount;
  }
  // Rare Slotopol jackpot pulse — tiny chance, premium feel.
  if (crypto.randomInt(10000) < 8) {
    const mult = 50 + crypto.randomInt(51);
    const amount = +(stake * mult).toFixed(2);
    wins.push({ line: 'Jackpot', symbol: '💎', count: 5, mult, amount });
    total += amount;
  }
  return { win: +total.toFixed(2), wins };
}
async function playSlotopolSpin(body) {
  const userId = Number(body.userId);
  const alias = String(body.alias || '').trim().slice(0, 120);
  const stake = Math.round(Number(body.stake || 0) * 100) / 100;
  if (!userId) return { success: false, error: 'Unauthorized' };
  if (!alias || !alias.includes('/')) return { success: false, error: 'Invalid Slotopol game alias' };
  if (!Number.isFinite(stake) || stake < 0.2) return { success: false, error: 'Min spin 0.20 TND' };
  if (stake > 1000) return { success: false, error: 'Max spin 1000 TND' };

  const users = await supa('GET', `/users?id=eq.${userId}&select=balance`);
  if (!Array.isArray(users) || !users.length) return { success: false, error: 'User not found' };
  const before = Number(users[0].balance || 0);
  if (before < stake) return { success: false, error: 'Insufficient balance', balance: before };

  let afterStake;
  try { afterStake = await updateBalance(userId, 'withdraw', stake); }
  catch (e) { return { success: false, error: e.message || 'Insufficient balance', balance: before }; }

  const reels = slotopolReels();
  const result = slotopolEvaluate(reels, stake);
  let finalBalance = afterStake;
  if (result.win > 0) {
    finalBalance = await updateBalance(userId, 'add', result.win);
  }

  await supa('POST', '/transactions', {
    user_id: userId,
    type: 'slotopol_spin',
    amount: +(result.win - stake).toFixed(2),
    balance_before: before,
    balance_after: finalBalance,
    description: `Slotopol: ${alias} | stake ${stake.toFixed(2)} | win ${result.win.toFixed(2)}`,
  }).catch(() => {});

  return {
    success: true,
    engine: 'Slotopol API adapter',
    alias,
    stake,
    win: result.win,
    balance: finalBalance,
    reels,
    wins: result.wins,
    spinId: crypto.randomBytes(8).toString('hex'),
  };
}

const CO = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Oroplay-Secret',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CO); return res.end(); }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const body = await parseBody(req);
  try {
    let R;
    if (p === '/api/wallet/balance') {
      const secret = req.headers['x-oroplay-secret'] || body.secret || '';
      R = (secret && secret !== ORO_SEAMLESS_SECRET) ? { success: false, error: "Unauthorized" } : await getBalance(body.username);
    } else if (p === '/api/wallet/deduct') {
      const secret = req.headers['x-oroplay-secret'] || body.secret || '';
      R = (secret && secret !== ORO_SEAMLESS_SECRET) ? { success: false, error: "Unauthorized" } : await deduct(body.username, body.amount, body.txId, body.gameCode);
    } else if (p === '/api/wallet/credit') {
      const secret = req.headers['x-oroplay-secret'] || body.secret || '';
      R = (secret && secret !== ORO_SEAMLESS_SECRET) ? { success: false, error: "Unauthorized" } : await credit(body.username, body.amount, body.txId, body.gameCode);
    } else if (p === '/api/wallet/session-end') {
      R = { success: true, message: "Session closed" };
    } else if (p === '/api/matches') {
      if (!cache.length || Date.now() - lastT > 35_000) await feed();
      const sport = url.searchParams.get('sport') || body.sport || 'all';
      const status = url.searchParams.get('status') || body.status || 'all';
      const limit = Math.min(Number(url.searchParams.get('limit') || body.limit || 300), 500);
      let matches = cache.filter(m => m.status !== 'finished');
      if (sport && sport !== 'all') matches = matches.filter(m => m.sport === sport);
      if (status && status !== 'all') matches = matches.filter(m => m.status === status);
      R = { success: true, matches: matches.slice(0, limit), count: matches.length, live: matches.filter(m => m.status === 'live').length, upcoming: matches.filter(m => m.status === 'upcoming').length, updatedAt: new Date(lastT).toISOString(), source: 'ESPN + DraftKings + TunBet model' };
    } else if (p === '/api/bet') {
      R = await placeBet(body.userId, body.eventId, body.market, body.selection, body.odds, body.stake);
    } else if (p === '/api/betbatch') {
      R = await placeBetBatch(body.userId, body.picks || body.selections, body.stake);
    } else if (p === '/api/mybets') {
      const userId = body.userId || url.searchParams.get('userId');
      R = await supa('GET', `/sports_bets?user_id=eq.${encodeURIComponent(userId)}&select=*&order=id.desc&limit=80`);
    } else if (p === '/api/slotopol/spin') {
      R = await playSlotopolSpin(body);
    } else if (p === '/api/slotopol/status') {
      R = { success: true, engine: 'Slotopol API adapter', games: 347, providers: 11, currency: 'TND' };
    } else if (p === '/api/oro/launch') {
      try { R = await oroLaunchGame(body.userCode, body.gameCode, body.vendorCode || 'slot-amatic', body.language || 'en'); }
      catch (e) { R = { error: e.message }; }
    } else if (p === '/api/oro/token') {
      try { R = await getOroToken(); } catch (e) { R = { error: e.message }; }
    } else if (p === '/api/status') {
      R = { ok: 1, server: 'TunBet Sportsbook v8', uptime: process.uptime() | 0, matches: cache.length, live: cache.filter(m => m.status === 'live').length, upcoming: cache.filter(m => m.status === 'upcoming').length, updatedAt: lastT ? new Date(lastT).toISOString() : null, sports: '/api/matches?sport=all|football|basketball|american-football|baseball|ice-hockey|mixed-martial-arts|tennis', betting: { single: '/api/bet', batch: '/api/betbatch', mybets: '/api/mybets' }, slotopol: { spin: '/api/slotopol/spin', status: '/api/slotopol/status' }, wallet: { balance: '/api/wallet/balance', deduct: '/api/wallet/deduct', credit: '/api/wallet/credit' }, oro: { launch: '/api/oro/launch', token: '/api/oro/token' } };
    } else {
      R = { svc: 'TunBet Sportsbook v8', status: '/api/status', sports: '/api/matches', bet: '/api/betbatch', slotopol: '/api/slotopol/*', wallet: '/api/wallet/*', oro: '/api/oro/*' };
    }
    res.writeHead(200, CO); res.end(JSON.stringify(R));
  } catch (e) {
    console.error('Server error:', e.message);
    res.writeHead(500, CO); res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log('🚀 TunBet Sportsbook v8 on :' + PORT);
  console.log('⚽ Sports: /api/matches, /api/betbatch');
  console.log('🎰 Slotopol: /api/slotopol/{status,spin}');
  feed().catch(console.error);
  try { fork('./scripts/sync-espn.js', { env: process.env, stdio: 'ignore' }); } catch (e) { console.log('ESPN Supabase sync skipped:', e.message); }
});

cron.schedule('*/1 * * * *', () => feed().catch(console.error));
cron.schedule('*/10 * * * *', () => { try { fork('./scripts/sync-espn.js', { env: process.env, stdio: 'ignore' }); } catch {} });
setInterval(() => { const u = process.env.RENDER_EXTERNAL_URL; if (u) https.get(u + '/api/status').on('error', () => {}); }, 840000);
