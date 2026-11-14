// Eventos: snapshot diário no D1; consultas ao SofaScore somente durante a criação do snapshot.
const TZ = 'America/Sao_Paulo';
const FOTMOB = 'https://www.fotmob.com/api/data/tvguide?country=br&timezone=America%2FSao_Paulo';
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const today = (date = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const localDate = iso => today(new Date(iso));
const teamLogo = id => Number.isSafeInteger(Number(id)) && Number(id) > 0 ? `https://images.fotmob.com/image_resources/logo/teamlogo/${Number(id)}.png` : null;
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
 result.push({id:String(m.id),home:m.home?.name||'',away:m.away?.name||'',homeTeamId:m.home?.id??null,awayTeamId:m.away?.id??null,homeLogo:teamLogo(m.home?.id),awayLogo:teamLogo(m.away?.id),league:m.leagueName||league.leagueName||'',utcTime:m.utcTime,channels:names,status:'scheduled',score:null});
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
// Futbol24: consulta em tempo real e busca por partida quando não aparece no in_play.
const FUTBOL_HEADERS={Accept:'application/json, text/plain, */*',Referer:'https://www.futbol24.com/pt/','User-Agent':'Mozilla/5.0 (compatible; NacaumTV/1.0)'};
const clean=s=>normalize(s).replace(/\b(fc|cf|sc|ac|club|clube|de|do|da|the|futebol|football)\b/g,' ').replace(/\s+/g,' ').trim();
const alias=s=>clean(s).replace(/\bmanchester utd\b/g,'manchester united').replace(/\binter rs\b/g,'internacional').replace(/\binter de porto alegre\b/g,'internacional').replace(/\b(women|feminino|feminina)\b/g,'w').replace(/\bsp\b|\brj\b|\brs\b|\bmg\b|\bba\b|\bpr\b|\bsc\b/g,'').replace(/\s+/g,' ').trim();
function teamSimilarity(a,b){const x=alias(a),y=alias(b);if(!x||!y)return 0;if(x===y)return 1;const xw=x.split(' '),yw=y.split(' ');const common=xw.filter(t=>yw.includes(t));const overlap=common.length/Math.max(xw.length,yw.length);return overlap>=.75?.85:0;}
function namesOf(m){return [m?.team1?.name||m?.team1?.name_short||m?.home?.name||m?.home,m?.team2?.name||m?.team2?.name_short||m?.away?.name||m?.away]}
function slugNames(slug){const parts=String(slug||'').split('/');const i=parts.indexOf('vs');return i>0&&i<parts.length-1?[parts[i-1].replace(/-/g,' '),parts[i+1].replace(/-/g,' ')]:['','']}
function matchQuality(m,e,slug){const [home,away]=namesOf(m);const [sh,sa]=slugNames(slug||m?.slug);return Math.max(teamSimilarity(home,e.home)*teamSimilarity(away,e.away),teamSimilarity(sh,e.home)*teamSimilarity(sa,e.away));}
function parseScore(m){const raw=m?.score1??m?.score??null;const text=typeof raw==='string'?raw:(Array.isArray(raw)?raw.join('-'):'');const result=text.match(/(\d+)\s*[-:x×]\s*(\d+)/i);if(result)return `${result[1]} - ${result[2]}`;if(Number.isInteger(m?.homeScore)&&Number.isInteger(m?.awayScore))return `${m.homeScore} - ${m.awayScore}`;return null;}
function isEnded(m){const status=m?.status||{};const name=normalize(typeof status==='object'?(status.name_short||status.name):status);return status.is_ended===true||m?.is_ended===true||m?.finished===true||/^(ft|aet|ap|finished|full time|final|ended|encerrado)$/.test(name);}
function isLive(m){return m?.status?.in_play===true||m?.in_play===true;}
function matchDay(m,e){const target=Date.parse(e.utcTime),actual=Date.parse(m?.date||'');if(!Number.isFinite(target)||!Number.isFinite(actual))return false;return Math.abs(target-actual)<=18*3600000 && localDate(m.date)===localDate(e.utcTime);}
function bestSearchMatch(rows,e){return (Array.isArray(rows)?rows:rows?.matches||rows?.results||[]).filter(m=>matchDay(m,e)).map(m=>({m,quality:matchQuality(m,e)})).filter(x=>x.quality>=.72).sort((a,b)=>b.quality-a.quality||Math.abs(Date.parse(a.m.date)-Date.parse(e.utcTime))-Math.abs(Date.parse(b.m.date)-Date.parse(e.utcTime)))[0]?.m||null;}
function applyMatch(e,m,liveEntry){if(!m)return;const score=parseScore(m)||parseScore(liveEntry);if(score)e.score=score;if(m.slug)e.futbolSlug=m.slug;if(m.id)e.futbolId=m.id;e._missingPolls=0;
 if(isEnded(m)){e.status='finished';e.minute=null;e._seenLive=true;return;}
 if(isLive(m)||isLive(liveEntry)){e.status='live';e._seenLive=true;e.minute=liveEntry?.minute??liveEntry?.time??m.minute??m.time??null;return;}
 // Dois flags falsos não significam fim. Mantém o estado anterior.
 if(e.status!=='live'&&e.status!=='finished')e.status='scheduled';
}
async function futbolJson(url){return getJson(url,FUTBOL_HEADERS)}
async function searchMatch(e){
 const queries=[e.home,`${e.home} ${e.away}`,e.away];
 for(const q of queries){
  try{const url=`https://www.futbol24.com/api/search/match?query=${encodeURIComponent(q)}`;const data=await futbolJson(url);const match=bestSearchMatch(data,e);if(match)return match;}
  catch(error){console.warn('[FUTBOL24 SEARCH]',q,error.message)}
 }
 return null;
}
async function monitor(events){
 const now=Date.now();const active=events.filter(e=>e.status!=='finished'&&Number.isFinite(Date.parse(e.utcTime))&&Date.parse(e.utcTime)<=now+60000);
 if(!active.length)return events;
 let entries=[];
 try{const data=await futbolJson(`https://www.futbol24.com/api/in_play?_=${now}`);const matches=data?.inplay?.matches||data?.matches||{};entries=Array.isArray(matches)?matches.map(m=>[m.slug||'',m]):Object.entries(matches)}
 catch(error){console.warn('[FUTBOL24 IN_PLAY]',error.message)}
 for(const e of active){
  const live=entries.map(([slug,m])=>({slug,m,quality:matchQuality(m,e,slug)})).filter(x=>x.quality>=.72).sort((a,b)=>b.quality-a.quality)[0];
  if(live){const m={...live.m,slug:live.slug||live.m.slug};applyMatch(e,m,live.m);if(isLive(live.m))continue;}
  // Pesquisa após o horário de início, inclusive para partidas que nunca foram vistas ao vivo.
  // Limita consultas a jogos das últimas 18 horas, evitando pesquisar jogos históricos a cada refresh.
  if(now-Date.parse(e.utcTime)>18*3600000)continue;
  const found=await searchMatch(e);
  if(found){
   const entry=entries.find(([slug,m])=>String(slug)===String(found.slug)||String(m?.id)===String(found.id));
   applyMatch(e,found,entry?.[1]);
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
