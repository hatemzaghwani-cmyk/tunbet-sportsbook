// Sync ESPN live scores → Supabase live_fixtures (no score columns)
const SB_URL = process.env.SUPABASE_URL || process.env.SUPA_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPA_KEY;
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
  { s: "tennis", id: "wta", n: "WTA" },
];
const a2d = a => { if(a==null||a===''||a==='OFF') return 0; if(typeof a==='object') a=a.american||a.odds||a.value||a.decimal; const n=Number(String(a).replace(/[+,]/g,'')); if(!Number.isFinite(n)||n===0) return 0; if(n>1&&n<100&&String(a).includes('.')) return +n.toFixed(2); return n>0 ? +(n/100+1).toFixed(2) : +(100/Math.abs(n)+1).toFixed(2); };
const v = (o,seed) => +(Math.max(1.01, o*(1+Math.sin(seed+Date.now()/30000)*.02))).toFixed(2);
function mkts(sp, h, a, od, hR, aR) {
  const M=1.05, sd=(h.length*31+a.length*17)%9999;
  let hO=a2d(od?.moneyline?.home?.close?.odds||od?.moneyline?.home?.open?.odds||od?.homeTeamOdds?.moneyLine), aO=a2d(od?.moneyline?.away?.close?.odds||od?.moneyline?.away?.open?.odds||od?.awayTeamOdds?.moneyLine), dO=a2d(od?.moneyline?.draw?.close?.odds||od?.drawOdds?.moneyLine);
  if(!hO||hO<=1){const hS=Math.max(.3,1.3-hR*.04),aS=Math.max(.3,1.3-aR*.04),t=hS+aS+.7;hO=v(M/(hS/t),sd);dO=v(M/(.7/t),sd+1);aO=v(M/(aS/t),sd+2)}
  if(!dO||dO<=1) dO=v(3.3,sd+5); hO=v(hO,sd+10); aO=v(aO,sd+12); dO=v(dO,sd+11);
  const hp=1/hO,dp=1/dO,ap=1/aO,gp=.42+Math.min(hp,ap)*.4,gg=.3+Math.min(hp,ap)/Math.max(hp,ap)*.25;
  if(sp==="soccer") return {"1X2":{"1":hO,"X":dO,"2":aO},"O/U 2.5":{Over:v(M/gp,sd+20),Under:v(M/(1-gp),sd+21)},"DC":{"1X":v(M/(hp+dp),sd+30),"12":v(M/(hp+ap),sd+31),"X2":v(M/(dp+ap),sd+32)},"BTTS":{GG:v(M/gg,sd+40),NG:v(M/(1-gg),sd+41)},"CS":{"1-0":v(7.2/Math.max(hp,.15),sd+50),"0-0":v(7.8,sd+51),"0-1":v(7.2/Math.max(ap,.15),sd+52)},"HT":{"1":v(hO*1.35,sd+60),"X":v(dO*.78,sd+61),"2":v(aO*1.35,sd+62)}};
  if(sp==="basketball"||sp==="football"){const tot=od?.overUnder||(sp==="basketball"?215.5:44.5),spr=od?.spread||(hp>ap?-3.5:3.5);return {ML:{[h]:hO,[a]:aO},Spread:{[`${h} ${spr}`]:v(1.91,sd+30),[`${a} ${-spr}`]:v(1.91,sd+31)},Total:{[`O ${tot}`]:v(1.91,sd+40),[`U ${tot}`]:v(1.91,sd+41)}};}
  if(sp==="baseball"){const tot=od?.overUnder||8.5;return {ML:{[h]:hO,[a]:aO},"Run Line":{[`${h} +1.5`]:v(1.91,sd+30),[`${a} -1.5`]:v(1.91,sd+31)},Total:{[`O ${tot}`]:v(1.91,sd+40),[`U ${tot}`]:v(1.91,sd+41)}};}
  if(sp==="hockey"){const tot=od?.overUnder||5.5;return {ML:{[h]:hO,[a]:aO},"Puck Line":{[`${h} +1.5`]:v(1.91,sd+30),[`${a} -1.5`]:v(1.91,sd+31)},Total:{[`O ${tot}`]:v(1.91,sd+40),[`U ${tot}`]:v(1.91,sd+41)}};}
  if(sp==="mma") return {Winner:{[h]:hO,[a]:aO},Method:{"KO/TKO":v(2.8,sd+30),Submission:v(4.2,sd+31),Decision:v(2.4,sd+32)},Rounds:{"O 2.5":v(1.85,sd+40),"U 2.5":v(1.95,sd+41)}};
  if(sp==="tennis") return {Winner:{[h]:hO,[a]:aO},Sets:{"O 2.5":v(2.1,sd+30),"U 2.5":v(1.75,sd+31)}};
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
    const ymd=t=>new Date(t).toISOString().slice(0,10).replace(/-/g,'');
    const range=`${ymd(Date.now()-2*86400_000)}-${ymd(Date.now()+21*86400_000)}`;
    const r = await fetch(`${ESPN}/${lg.s}/${lg.id}/scoreboard?dates=${range}&limit=60`);
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
      const od = (Array.isArray(c.odds)?(c.odds.find(o=>/draft\s*kings?/i.test(o?.provider?.name||o?.provider?.displayName||''))||c.odds.find(Boolean)):null)||null;
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
