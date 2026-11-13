// Eventos: snapshot diário no D1; consultas ao SofaScore somente durante a criação do snapshot.
const TZ = 'America/Sao_Paulo';
const FOTMOB = 'https://www.fotmob.com/api/data/tvguide?country=br&timezone=America%2FSao_Paulo';
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const today = (date = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const localDate = iso => today(new Date(iso));
const channels = ['disney+','prime video','globo','canal goat','sportv','premiere','xsports','redetv','espn','bandsports','ge tv','paramount+','cazetv','record','sportynet','hbo max','space','tnt','nsports','sbt','band'];
function channelName(raw) {
 const s=normalize(raw);
 if (s.includes('disney')) return 'Disney+';
 if (s.includes('amazon prime') || s.includes('prime video')) return 'Prime Video';
 if (s.includes('sportv')) return 'SporTV';
 if (s.includes('premiere')) return 'Premiere';
 if (/^espn( [234])?$/.test(s)) return s.toUpperCase();
 if (s.includes('ge tv')) return 'GE TV';
 if (s.includes('canal goat')) return 'Canal GOAT';
 if (s.includes('caze')) return 'CazéTV';
 if (s.includes('paramount')) return 'Paramount+';
 if (s.includes('globoplay') || s.includes('tv globo')) return 'Globo';
 const matched=channels.find(c=>s===normalize(c));
 return matched || null;
}
const sofaIds={7213:'SporTV',7214:'SporTV 2',7215:'SporTV 3',5613:'Premiere',3182:'Premiere 5'};
// IDs adicionais podem ser cadastrados em SOFA_CHANNEL_IDS (JSON {"123":"Premiere 2"}).
function sofaMap(env){try{return {...sofaIds,...JSON.parse(env.SOFA_CHANNEL_IDS||'{}')}}catch{return sofaIds}}
async function getJson(url, headers={}) {const r=await fetch(url,{headers,signal:AbortSignal.timeout(14000)});if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);return r.json()}
async function sofaJson(env,url){if(!env.SCRAPERAPI_KEY)return null;const api=new URL('https://api.scraperapi.com/');api.searchParams.set('api_key',env.SCRAPERAPI_KEY);api.searchParams.set('url',url);return getJson(api.toString())}
async function enrichSofa(env,event){
 const broad=event.channels.some(c=>/^(SporTV|Premiere)$/.test(c));if(!broad)return event;
 try{
  const q=encodeURIComponent(`${event.home} - ${event.away}`);
  const search=await sofaJson(env,`https://www.sofascore.com/api/v1/search/all?q=${q}&page=0`);
  const expected=new Date(event.utcTime).getTime();
  const matches=(search?.results||[]).map(x=>x.entity).filter(x=>x?.id&&x?.startTimestamp&&Math.abs(x.startTimestamp*1000-expected)<24*3600000);
  const exact=matches.find(x=>normalize(x.homeTeam?.name)===normalize(event.home)&&normalize(x.awayTeam?.name)===normalize(event.away));
  if(!exact)return event;
  const data=await sofaJson(env,`https://www.sofascore.com/api/v1/tv/event/${exact.id}/country-channels`);
  const ids=data?.countryChannels?.BR||[];const mapping=sofaMap(env);
  const precise=ids.map(id=>mapping[id]).filter(Boolean);
  if(precise.length){event.channels=[...new Set([...event.channels.filter(c=>!['SporTV','Premiere'].includes(c)),...precise])];}
 }catch(e){console.warn('[EVENTS SOFA]',e.message)}
 return event;
}
function flatten(data,date){const result=[];for(const [key,leagues] of Object.entries(data||{}))for(const league of leagues||[])for(const m of league.matches||[]){
 if(!m.utcTime||localDate(m.utcTime)!==date)continue;
 const names=[...new Set((m.channels||[]).map(c=>channelName(c.name)).filter(Boolean))];if(!names.length)continue;
 result.push({id:String(m.id),home:m.home?.name||'',away:m.away?.name||'',league:m.leagueName||league.leagueName||'',utcTime:m.utcTime,channels:names,status:'scheduled',score:null});
 }return result}
async function fetchFotmob(env) {
 // Cloudflare pode receber 403 na origem. Usa ScraperAPI somente quando necessário.
 try { return await getJson(FOTMOB); }
 catch (directError) {
  if (!env.SCRAPERAPI_KEY) throw new Error(`FotMob direto falhou (${directError.message}); configure SCRAPERAPI_KEY na Cloudflare.`);
  const api = new URL('https://api.scraperapi.com/');
  api.searchParams.set('api_key', env.SCRAPERAPI_KEY);
  api.searchParams.set('url', FOTMOB);
  try { return await getJson(api.toString()); }
  catch (proxyError) { throw new Error(`FotMob direto: ${directError.message}; ScraperAPI: ${proxyError.message.replace(/api_key=[^&]+/, 'api_key=[redacted]')}`); }
 }
}
async function snapshot(env,date){
 const data=await fetchFotmob(env);const events=flatten(data,date);
 for(const e of events)await enrichSofa(env,e);
 await env.DB.prepare('INSERT INTO event_snapshots (day,events,updated_at) VALUES (?,?,?) ON CONFLICT(day) DO UPDATE SET events=excluded.events, updated_at=excluded.updated_at').bind(date,JSON.stringify(events),Date.now()).run();
 return events;
}
// Futbol24: o FotMob define a programação; o Futbol24 atualiza os placares.
const FUTBOL_HEADERS={Accept:'application/json, text/plain, */*',Referer:'https://www.futbol24.com/pt/','User-Agent':'Mozilla/5.0 (compatible; NacaumTV/1.0)'};
const shortName=s=>normalize(s).replace(/\b(fc|cf|sc|ac|club|clube|de|do|da|the)\b/g,' ').replace(/\s+/g,' ').trim();
function sameTeam(a,b){const x=shortName(a),y=shortName(b);return !!x&&!!y&&(x===y||(x.length>=5&&y.length>=5&&(x.startsWith(y)||y.startsWith(x))));}
function matchSlug(slug,event){const p=slug.split('/').filter(Boolean),i=p.indexOf('vs');if(i<1||i>=p.length-1)return false;let h=p[i-1].replace(/-/g,' '),a=p[i+1].replace(/-/g,' ');try{h=decodeURIComponent(h);a=decodeURIComponent(a)}catch{}return sameTeam(h,event.home)&&sameTeam(a,event.away)}
function scoreOf(m){const text=String(m?.score1??m?.score??'');const x=text.match(/(\d+)\s*[-:x×]\s*(\d+)/i);return x?`${x[1]} - ${x[2]}`:null}
// Segue o mesmo princípio do monitor.js: transição in_play true -> false,
// is_ended explícito e persistência do último placar.
// Quando a partida desaparece, exigimos duas leituras válidas consecutivas
// para não confundir uma falha transitória do feed com fim de jogo.
function ended(m){
 const state=normalize(m?.status||m?.state||m?.match_status||'');
 return m?.is_ended===true||m?.finished===true||m?.is_finished===true||m?.isFinished===true||
   /^(ft|finished|full time|final|ended|encerrado|after penalties|aet)$/.test(state);
}
async function monitor(events){
 const now=Date.now();
 const active=events.filter(e=>e.status!=='finished'&&Number.isFinite(Date.parse(e.utcTime))&&Date.parse(e.utcTime)<=now+60000);
 if(!active.length)return events;
 let matches;
 try{
  const data=await getJson('https://www.futbol24.com/api/in_play?_='+Date.now(),FUTBOL_HEADERS);
  matches=data?.inplay?.matches||data?.matches;
  if(!matches||typeof matches!=='object')throw Error('Resposta sem matches');
 }catch(err){console.warn('[FUTBOL24]',err.message);return events}
 const entries=Object.entries(matches);
 for(const e of active){
  const found=entries.find(([slug])=>matchSlug(slug,e));
  if(found){
   const [,m]=found;
   const score=scoreOf(m);
   if(score)e.score=score;
   e._missingPolls=0;
   if(ended(m)){
    e.status='finished';e.minute=null;e._seenLive=true;
   }else if(m.in_play===true){
    e.status='live';e._seenLive=true;e.minute=m.minute??m.time??null;
   }else if(e._seenLive===true && m.in_play===false && e.score){
    // Condição de fim de jogo utilizada no monitor.js original.
    e.status='finished';e.minute=null;
   }
  }else if(e._seenLive===true && e.status==='live'){
   // O jogo estava ao vivo e saiu do /in_play. Duas confirmações
   // reduzem falsos positivos por oscilação temporária da API.
   e._missingPolls=(e._missingPolls||0)+1;
   if(e._missingPolls>=2 && e.score){e.status='finished';e.minute=null}
  }
 }
 return events;
}

export async function onRequestGet({env}){
 if(!env.DB)return Response.json({error:'Vincule o D1 com o nome DB.'},{status:503});
 try{
 const day=today();let row=await env.DB.prepare('SELECT events FROM event_snapshots WHERE day=?').bind(day).first();
 if(!row){const previous=new Date(Date.now()-86400000);const yesterday=today(previous);const old=await env.DB.prepare('SELECT events FROM event_snapshots WHERE day=?').bind(yesterday).first();
 let events=await snapshot(env,day);// Não misturar jogos de ontem com a programação de hoje.
 row={events:JSON.stringify(events)};}
 const events=await monitor(JSON.parse(row.events));
 await env.DB.prepare('UPDATE event_snapshots SET events=? WHERE day=?').bind(JSON.stringify(events),day).run();
 return Response.json({date:day,events},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('[EVENTS]',e);return Response.json({error:'Não foi possível atualizar os eventos.',detail:e.message},{status:502})}
}
