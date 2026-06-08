// Sync ESPN live scores → Supabase live_fixtures (no score columns)
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SB_URL || !SB_KEY) { console.error("Missing env"); process.exit(1); }
const SB = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" };
const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const LEAGUES = [
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
  { s: "soccer", id: "ned.1", n: "Eredivisie" },
  { s: "basketball", id: "nba", n: "NBA" },
  { s: "basketball", id: "wnba", n: "WNBA" },
  { s: "football", id: "nfl", n: "NFL" },
  { s: "baseball", id: "mlb", n: "MLB" },
  { s: "hockey", id: "nhl", n: "NHL" },
  { s: "mma", id: "ufc", n: "UFC" },
  { s: "tennis", id: "atp", n: "ATP" },
];
const a2d = a => !a ? 0 : a > 0 ? +(a/100+1).toFixed(2) : +(100/Math.abs(a)+1).toFixed(2);
const v = (o,seed) => +(Math.max(1.01, o*(1+Math.sin(seed+Date.now()/30000)*.02))).toFixed(2);
function mkts(sp, h, a, od, hR, aR) {
  const M=1.05, sd=(h.length*31+a.length*17)%9999;
  let hO=a2d(od?.homeTeamOdds?.moneyLine), aO=a2d(od?.awayTeamOdds?.moneyLine), dO=a2d(od?.drawOdds?.moneyLine);
  if(!hO||hO<=1){const hS=Math.max(.3,1.3-hR*.04),aS=Math.max(.3,1.3-aR*.04),t=hS+aS+.7;hO=v(M/(hS/t),sd);dO=v(M/(.7/t),sd+1);aO=v(M/(aS/t),sd+2)}
  if(!dO||dO<=1) dO=v(3.3,sd+5); hO=v(hO,sd+10); aO=v(aO,sd+12); dO=v(dO,sd+11);
  const hp=1/hO,dp=1/dO,ap=1/aO,gp=.42+Math.min(hp,ap)*.4,gg=.3+Math.min(hp,ap)/Math.max(hp,ap)*.25;
  if(sp==="soccer") return {"1X2":{"1":hO,"X":dO,"2":aO},"O/U 2.5":{Over:v(M/gp,sd+20),Under:v(M/(1-gp),sd+21)},"DC":{"1X":v(M/(hp+dp),sd+30),"12":v(M/(hp+ap),sd+31),"X2":v(M/(dp+ap),sd+32)},"BTTS":{GG:v(M/gg,sd+40),NG:v(M/(1-gg),sd+41)}};
  if(sp==="basketball") return {ML:{[h]:hO,[a]:aO}};
  if(sp==="football") return {ML:{[h]:hO,[a]:aO}};
  if(sp==="baseball") return {ML:{[h]:hO,[a]:aO}};
  if(sp==="hockey") return {ML:{[h]:hO,Draw:dO,[a]:aO}};
  return {Winner:{[h]:hO,[a]:aO}};
}
async function supaUpsert(rows) {
  if(!rows.length) return;
  const r = await fetch(`${SB_URL}/rest/v1/live_fixtures?on_conflict=id`, { method:"POST", headers:SB, body:JSON.stringify(rows) });
  if(!r.ok) console.error(`  ✗ upsert HTTP ${r.status}: ${await r.text()}`);
  else console.log(`  ✓ ${rows.length} upserted`);
}
async function syncLeague(lg) {
  try {
    const r = await fetch(`${ESPN}/${lg.s}/${lg.id}/scoreboard`);
    if(!r.ok) { console.log(`  ✗ HTTP ${r.status}`); return; }
    const d = await r.json();
    if(!d?.events) { console.log("  no events"); return; }
    const rows = [];
    for(const e of d.events) {
      const c = e.competitions?.[0]; if(!c) continue;
      const ts = c.competitors||[];
      const home = ts.find(t=>t.homeAway==="home")||ts[0];
      const away = ts.find(t=>t.homeAway==="away")||ts[1];
      if(!home?.team||!away?.team) continue;
      const st = e.status?.type?.name||"";
      const live = st.includes("PROGRESS")||st.includes("HALFTIME");
      const fin = st.includes("FINAL")||st.includes("FULL_TIME");
      const od = (c.odds||[])[0]||null;
      const hR = +(home.curatedRank?.current||home.order||5);
      const aR = +(away.curatedRank?.current||away.order||5);
      const sportMap = {soccer:"football",basketball:"basketball",football:"american-football",baseball:"baseball",hockey:"ice-hockey",mma:"mixed-martial-arts",tennis:"tennis"};
      const sport = sportMap[lg.s]||lg.s;
      const markets = (!fin) ? mkts(lg.s, home.team.shortDisplayName||home.team.displayName, away.team.shortDisplayName||away.team.displayName, od, hR, aR) : null;
      rows.push({
        id: `espn_${e.id}`, sport, league: `⭐ ${lg.n}`,
        home_team: home.team.displayName, away_team: away.team.displayName,
        commence_time: e.date, status: fin?"finished":live?"live":"upcoming",
        markets_data: markets ? JSON.stringify(markets) : null,
        updated_at: new Date().toISOString(),
      });
    }
    console.log(`  ${lg.n}: ${rows.length} events (${rows.filter(r=>r.status==="live").length} live)`);
    await supaUpsert(rows);
  } catch(e) { console.error(`  ✗ ${lg.n}: ${e.message}`); }
}
(async()=>{
  console.log(`\n=== ESPN Sync ${new Date().toISOString()} ===`);
  for(const lg of LEAGUES) { console.log(`\n→ ${lg.s}/${lg.id}`); await syncLeague(lg); }
  const cutoff = new Date(Date.now()-6*3600_000).toISOString();
  await fetch(`${SB_URL}/rest/v1/live_fixtures?commence_time=lt.${cutoff}`, { method:"DELETE", headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`} });
  console.log(`\n✓ pruned > 6h old\n=== Done ===`);
})().catch(e=>{console.error(e);process.exit(1)});
