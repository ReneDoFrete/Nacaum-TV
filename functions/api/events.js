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
async function snapshot(env,date){
 const data=await getJson(FOTMOB);const events=flatten(data,date);
 for(const e of events)await enrichSofa(env,e);
 await env.DB.prepare('INSERT INTO event_snapshots (day,events,updated_at) VALUES (?,?,?) ON CONFLICT(day) DO UPDATE SET events=excluded.events, updated_at=excluded.updated_at').bind(date,JSON.stringify(events),Date.now()).run();
 return events;
}
// Futbol24: apenas partidas cujo horário já chegou, com correspondência estrita dos dois times.
async function monitor(events){const active=events.filter(e=>e.status!=='finished'&&new Date(e.utcTime).getTime()<=Date.now()+60000);if(!active.length)return events;
 let inplay={};try{const data=await getJson('https://www.futbol24.com/api/in_play');inplay=data?.inplay?.matches||data?.matches||{}}catch{return events}
 const entries=Object.entries(inplay);
 for(const e of active){const found=entries.find(([slug])=>{const parts=slug.split('/').filter(Boolean);const i=parts.indexOf('vs');return i>0&&normalize(parts[i-1].replaceAll('-',' '))===normalize(e.home)&&normalize(parts[i+1]?.replaceAll('-',' '))===normalize(e.away)});
 if(found){const match=found[1];const score=String(match.score1||'').match(/^(\d+)\s*[-:x]\s*(\d+)$/i);if(score)e.score=`${score[1]} - ${score[2]}`;if(match.in_play===true)e.status='live';else if(e.status==='live')e.status='finished';}
 }
 return events;
}
export async function onRequestGet({env}){
 if(!env.DB)return Response.json({error:'Vincule o D1 com o nome DB.'},{status:503});
 try{
 const day=today();let row=await env.DB.prepare('SELECT events FROM event_snapshots WHERE day=?').bind(day).first();
 if(!row){const previous=new Date(Date.now()-86400000);const yesterday=today(previous);const old=await env.DB.prepare('SELECT events FROM event_snapshots WHERE day=?').bind(yesterday).first();
 let events=await snapshot(env,day);if(old){const ongoing=JSON.parse(old.events).filter(e=>e.status==='live');events=[...ongoing,...events]};row={events:JSON.stringify(events)};}
 const events=await monitor(JSON.parse(row.events));
 await env.DB.prepare('UPDATE event_snapshots SET events=? WHERE day=?').bind(JSON.stringify(events),day).run();
 return Response.json({date:day,events},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('[EVENTS]',e);return Response.json({error:'Não foi possível atualizar os eventos.',detail:e.message},{status:502})}
}
