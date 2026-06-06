const http=require('http'),https=require('https'),cron=require('node-cron');
const PORT=process.env.PORT||4000,SU=process.env.SUPA_URL,SK=process.env.SUPA_KEY;
const ESPN="https://site.api.espn.com/apis/site/v2/sports";
const LG=[{s:"soccer",id:"eng.1",n:"Premier League"},{s:"soccer",id:"esp.1",n:"La Liga"},{s:"soccer",id:"ger.1",n:"Bundesliga"},{s:"soccer",id:"ita.1",n:"Serie A"},{s:"soccer",id:"fra.1",n:"Ligue 1"},{s:"soccer",id:"uefa.champions",n:"Champions League"},{s:"soccer",id:"usa.1",n:"MLS"},{s:"soccer",id:"bra.1",n:"Brasileirão"},{s:"soccer",id:"tur.1",n:"Süper Lig"},{s:"soccer",id:"por.1",n:"Liga Portugal"},{s:"soccer",id:"fifa.worldq.conmebol",n:"WCQ CONMEBOL"},{s:"soccer",id:"fifa.worldq.uefa",n:"WCQ UEFA"},{s:"basketball",id:"nba",n:"NBA"},{s:"basketball",id:"wnba",n:"WNBA"},{s:"football",id:"nfl",n:"NFL"},{s:"baseball",id:"mlb",n:"MLB"},{s:"hockey",id:"nhl",n:"NHL"},{s:"mma",id:"ufc",n:"UFC"},{s:"tennis",id:"atp",n:"ATP"},{s:"tennis",id:"wta",n:"WTA"}];
const IC={soccer:"⚽",basketball:"🏀",football:"🏈",baseball:"⚾",hockey:"🏒",mma:"🥊",tennis:"🎾"};
function get(u){return new Promise((y,n)=>{https.get(u,{headers:{'User-Agent':'TB'}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{y(JSON.parse(d))}catch{y(null)}})}).on('error',n)})}
function supa(m,p,b){return new Promise((y,n)=>{const u=new URL(SU+'/rest/v1'+p);const r=https.request({hostname:u.hostname,path:u.pathname+u.search,method:m,headers:{apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json',Prefer:'return=minimal,resolution=merge-duplicates'}},s=>{let d='';s.on('data',c=>d+=c);s.on('end',()=>{try{y(JSON.parse(d))}catch{y(d)}})});r.on('error',n);if(b)r.write(JSON.stringify(b));r.end()})}
const a2d=a=>!a?0:a>0?+(a/100+1).toFixed(2):+(100/Math.abs(a)+1).toFixed(2);
const v=(o,s)=>+(Math.max(1.01,o*(1+Math.sin(s+Date.now()/30000)*.02))).toFixed(2);

function mkts(sp,h,a,od,hR,aR){
  const M=1.05,sd=(h.length*31+a.length*17)%9999;
  let hO=a2d(od?.homeTeamOdds?.moneyLine),aO=a2d(od?.awayTeamOdds?.moneyLine),dO=a2d(od?.drawOdds?.moneyLine);
  if(!hO||hO<=1){const hS=Math.max(.3,1.3-hR*.04),aS=Math.max(.3,1.3-aR*.04),t=hS+aS+.7;hO=v(M/(hS/t),sd);dO=v(M/(.7/t),sd+1);aO=v(M/(aS/t),sd+2)}
  if(!dO||dO<=1)dO=v(3.3,sd+5);hO=v(hO,sd+10);aO=v(aO,sd+12);dO=v(dO,sd+11);
  const hp=1/hO,dp=1/dO,ap=1/aO,gp=.42+Math.min(hp,ap)*.4,gg=.3+Math.min(hp,ap)/Math.max(hp,ap)*.25;
  if(sp==='soccer')return{"1X2":{"1":hO,"X":dO,"2":aO},"O/U 2.5":{"Over":v(M/gp,sd+20),"Under":v(M/(1-gp),sd+21)},"O/U 1.5":{"Over":v(M/Math.min(.9,gp+.25),sd+22),"Under":v(M/Math.max(.1,1-gp-.25),sd+23)},"DC":{"1X":v(M/(hp+dp),sd+30),"12":v(M/(hp+ap),sd+31),"X2":v(M/(dp+ap),sd+32)},"BTTS":{"GG":v(M/gg,sd+40),"NG":v(M/(1-gg),sd+41)},"CS":{"1-0":v(6.5/hp,sd+50),"0-0":v(7.8,sd+51),"0-1":v(6.5/ap,sd+52),"2-1":v(9/hp,sd+53),"1-1":v(5.5,sd+54)},"HT":{"1":v(hO*1.35,sd+60),"X":v(dO*.7,sd+61),"2":v(aO*1.35,sd+62)}};
  if(sp==='basketball'){const sp2=od?.spread||(hp>ap?-3.5:3.5),tot=od?.overUnder||215;return{"ML":{[h]:hO,[a]:aO},"Spread":{[h+' '+sp2]:v(1.91,sd+30),[a+' '+-sp2]:v(1.91,sd+31)},"Total":{['O '+tot]:v(1.91,sd+40),['U '+tot]:v(1.91,sd+41)}};}
  if(sp==='football'){const sp2=od?.spread||-3.5,tot=od?.overUnder||44;return{"ML":{[h]:hO,[a]:aO},"Spread":{[h+' '+sp2]:v(1.91,sd+30),[a+' '+-sp2]:v(1.91,sd+31)},"Total":{['O '+tot]:v(1.91,sd+40),['U '+tot]:v(1.91,sd+41)}};}
  if(sp==='baseball'){const tot=od?.overUnder||8.5;return{"ML":{[h]:hO,[a]:aO},"RL":{[h+' -1.5']:v(M/(hp*.45),sd+30),[a+' +1.5']:v(M/(ap+dp*.4),sd+31)},"Total":{['O '+tot]:v(1.91,sd+40),['U '+tot]:v(1.91,sd+41)}};}
  if(sp==='hockey')return{"ML":{[h]:hO,"Draw":dO,[a]:aO},"PL":{[h+' -1.5']:v(M/(hp*.4),sd+30),[a+' +1.5']:v(M/(ap+dp*.45),sd+31)},"Total":{"O 5.5":v(1.91,sd+40),"U 5.5":v(1.91,sd+41)}};
  if(sp==='mma')return{"Winner":{[h]:hO,[a]:aO},"Method":{"KO":v(M/(hp*.4),sd+30),"Sub":v(M/(hp*.25),sd+31),"Dec":v(M/.35,sd+32)},"Rounds":{"O 2.5":v(1.85,sd+40),"U 2.5":v(1.95,sd+41)}};
  if(sp==='tennis')return{"Winner":{[h]:hO,[a]:aO},"Sets":{"O 2.5":v(2.1,sd+30),"U 2.5":v(1.75,sd+31)}};
  return{"Winner":{[h]:hO,[a]:aO}};
}

let cache=[],prevSc={},lastT=0,suspended={};

async function feed(){
  console.log(`[${new Date().toISOString()}] Feed...`);
  const all=[];
  for(const l of LG){try{
    const d=await get(`${ESPN}/${l.s}/${l.id}/scoreboard`);if(!d?.events)continue;
    for(const e of d.events){
      const c=e.competitions?.[0];if(!c)continue;
      const ts=c.competitors||[],h=ts.find(t=>t.homeAway==='home')||ts[0],a=ts.find(t=>t.homeAway==='away')||ts[1];
      if(!h?.team||!a?.team)continue;
      const st=e.status?.type?.name||'',live=st.includes('PROGRESS')||st.includes('HALFTIME'),fin=st.includes('FINAL')||st.includes('FULL_TIME');
      const hS=+h.score||0,aS=+a.score||0,id=e.id;
      const prev=prevSc[id];const goal=prev&&(prev.h!==hS||prev.a!==aS);
      prevSc[id]={h:hS,a:aS};
      if(goal){suspended[id]=Date.now();console.log(`⚽ GOAL! ${h.team.displayName} ${hS}-${aS} ${a.team.displayName}`);}
      const isSusp=suspended[id]&&(Date.now()-suspended[id]<30000);
      const od=(c.odds||[])[0]||null;
      const hR=+(h.curatedRank?.current||h.order||5),aR=+(a.curatedRank?.current||a.order||5);
      const m=(!fin&&!isSusp)?mkts(l.s,h.team.shortDisplayName||h.team.displayName,a.team.shortDisplayName||a.team.displayName,od,hR,aR):null;
      all.push({id,league:`${IC[l.s]||'🏅'} ${l.n}`,sport:l.s,home:h.team.displayName,away:a.team.displayName,homeLogo:h.team.logo||'',awayLogo:a.team.logo||'',date:e.date,status:fin?'finished':live?'live':'upcoming',clock:e.status?.displayClock||'',period:e.status?.type?.shortDetail||'',homeScore:hS,awayScore:aS,suspended:isSusp,hasRealOdds:!!od,markets:m});
      // Auto-settle finished matches
      if(fin&&prev&&!prev.settled){prev.settled=true;settleBets(id,hS,aS,l.s).catch(()=>{});}
    }}catch(x){console.error(l.n,x.message)}}
  all.sort((a,b)=>(a.status==='live'?0:a.status==='upcoming'?1:2)-(b.status==='live'?0:b.status==='upcoming'?1:2)||new Date(a.date)-new Date(b.date));
  cache=all;lastT=Date.now();
  console.log(`  ${all.length} matches, ${all.filter(m=>m.status==='live').length} live, ${all.filter(m=>m.status==='finished').length} finished`);
}

// AUTO SETTLE BETS
async function settleBets(eventId,hS,aS,sport){
  console.log(`  Settling bets for ${eventId} (${hS}-${aS})`);
  const bets=await supa('GET',`/sports_bets?event_id=eq.${eventId}&status=eq.pending&select=*`);
  if(!Array.isArray(bets)||!bets.length)return;
  for(const b of bets){
    const sel=b.selection,mk=b.sport||'';
    let won=false;
    // Determine win based on market and selection
    if(mk==='1X2'){won=(sel==='1'&&hS>aS)||(sel==='X'&&hS===aS)||(sel==='2'&&hS<aS)}
    else if(mk==='O/U 2.5'){won=(sel==='Over'&&hS+aS>2.5)||(sel==='Under'&&hS+aS<2.5)}
    else if(mk==='O/U 1.5'){won=(sel==='Over'&&hS+aS>1.5)||(sel==='Under'&&hS+aS<1.5)}
    else if(mk==='BTTS'){won=(sel==='GG'&&hS>0&&aS>0)||(sel==='NG'&&(hS===0||aS===0))}
    else if(mk==='DC'){won=(sel==='1X'&&hS>=aS)||(sel==='12'&&hS!==aS)||(sel==='X2'&&hS<=aS)}
    else if(mk==='ML'||mk==='Winner'){const hn=b.event_name?.split(' vs ')?.[0]||'';won=(sel===hn||sel.includes(hn.substring(0,8)))?(hS>aS):(hS<aS)}
    const status=won?'won':'lost';
    await supa('PATCH',`/sports_bets?id=eq.${b.id}`,{status});
    if(won){
      const users=await supa('GET',`/users?id=eq.${b.user_id}&select=balance`);
      if(Array.isArray(users)&&users[0]){
        const payout=b.potential_win;
        await supa('POST','/rpc/update_balance',{p_user_id:b.user_id,p_action:'add',p_amount:payout});
        await supa('POST','/transactions',{user_id:b.user_id,type:'win',amount:payout,balance_before:+users[0].balance,balance_after:+users[0].balance+payout,description:`Won: ${b.event_name} | ${b.selection_name}`});
        console.log(`    💰 User ${b.user_id} won ${payout} TND`);
      }
    }
  }
}

// VALIDATE & PLACE BET (anti-cheat)
async function placeBet(userId,eventId,market,selection,odds,stake){
  const m=cache.find(x=>x.id===eventId);
  if(!m)return{error:'Match not found'};
  if(m.status==='finished')return{error:'Match finished'};
  if(m.suspended)return{error:'Markets suspended (goal scored) - wait 30s'};
  if(!m.markets)return{error:'Markets closed'};
  // Verify odds from SERVER (not from client)
  const mkt=m.markets[market];
  if(!mkt)return{error:'Market not found: '+market};
  let serverOdds=mkt[selection];
  if(!serverOdds)return{error:'Selection not found: '+selection};
  if(Math.abs(serverOdds-odds)/odds>0.01)return{error:'Odds changed',currentOdds:serverOdds,yourOdds:odds};
  // Check balance
  const users=await supa('GET',`/users?id=eq.${userId}&select=balance`);
  if(!Array.isArray(users)||!users.length)return{error:'User not found'};
  const bal=+users[0].balance;
  if(bal<stake)return{error:'Insufficient balance',balance:bal};
  if(stake<0.5)return{error:'Minimum bet 0.50 TND'};
  if(stake>5000)return{error:'Maximum bet 5000 TND'};
  // LIVE BET DELAY: 5 seconds anti-courtsiding
  if(m.status==='live'){
    await new Promise(r=>setTimeout(r,5000));
    // Re-check after delay: score might have changed
    const fresh=cache.find(x=>x.id===eventId);
    if(!fresh)return{error:'Match not found after delay'};
    if(fresh.suspended)return{error:'Goal scored during delay - bet rejected'};
    if(fresh.status==='finished')return{error:'Match finished during delay'};
    // Re-verify odds after delay
    if(fresh.markets){const fmk=fresh.markets[market];if(fmk){const fOdds=fmk[selection];if(fOdds&&Math.abs(fOdds-serverOdds)/serverOdds>0.01)return{error:'Odds changed during delay',currentOdds:fOdds}}}
    serverOdds=fresh.markets?.[market]?.[selection]||serverOdds;
  }
  // ATOMIC: deduct + record
  await supa('POST','/rpc/update_balance',{p_user_id:userId,p_action:'withdraw',p_amount:stake});
  await supa('POST','/sports_bets',{user_id:userId,event_id:eventId,event_name:`${m.home} vs ${m.away}`,sport:market,league:m.league,selection,selection_name:`${market}: ${selection}`,odds:serverOdds,stake,potential_win:+(stake*serverOdds).toFixed(2),status:'pending'});
  await supa('POST','/transactions',{user_id:userId,type:'bet',amount:-stake,balance_before:bal,balance_after:bal-stake,description:`${m.home} vs ${m.away} | ${market}: ${selection} @${serverOdds}`});
  return{success:true,odds:serverOdds,potentialWin:+(stake*serverOdds).toFixed(2),newBalance:+(bal-stake).toFixed(2)};
}

const CO={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json'};
http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,CO);return res.end()}
  const p=new URL(req.url,`http://localhost:${PORT}`).pathname;
  let body={};if(req.method==='POST')body=await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{try{r(JSON.parse(d))}catch{r({})}})});
  try{let R;
    if(p==='/api/matches'){if(Date.now()-lastT>60000)await feed();R={matches:cache.filter(m=>m.status!=='finished'),count:cache.length,live:cache.filter(m=>m.status==='live').length,ts:new Date(lastT).toISOString()}}
    else if(p==='/api/bet'&&req.method==='POST'){const{userId,eventId,market,selection,odds,stake}=body;R=(!userId||!eventId)?{error:'Missing fields'}:await placeBet(userId,eventId,market,selection,odds,+stake)}
    else if(p==='/api/mybets'&&req.method==='POST'){const{userId}=body;R=await supa('GET',`/sports_bets?user_id=eq.${userId}&select=*&order=id.desc&limit=50`)}
    else if(p==='/api/status'){R={ok:1,m:cache.length,live:cache.filter(m=>m.status==='live').length,up:process.uptime()|0}}
    else R={svc:'TunBet Sportsbook v3'};
    res.writeHead(200,CO);res.end(JSON.stringify(R))
  }catch(e){res.writeHead(500,CO);res.end(JSON.stringify({error:e.message}))}
}).listen(PORT,()=>{console.log('Sportsbook v3 on :'+PORT);feed()});
cron.schedule('*/1 * * * *',()=>feed().catch(console.error));
setInterval(()=>{const u=process.env.RENDER_EXTERNAL_URL;if(u)https.get(u+'/api/status').on('error',()=>{})},840000);
