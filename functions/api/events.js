import { SOFASCORE_CHANNELS } from './sofascore-channels.js';

// API de eventos: snapshots no D1, canais FotMob e placares Futbol24.
const TZ = 'America/Sao_Paulo';
const FOTMOB = 'https://www.fotmob.com/api/data/tvguide?country=br&timezone=America%2FSao_Paulo';
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const today = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit'}).format(date);
const localDate = iso => today(new Date(iso));
const teamLogo = id => Number.isSafeInteger(Number(id)) && Number(id) > 0 ? `https://images.fotmob.com/image_resources/logo/teamlogo/${Number(id)}.png` : null;

function channelName(raw) {
  const s = normalize(raw);
  if (!s) return null;
  if (s.includes('disney')) return 'Disney+';
  if (s === 'apple tv' || s === 'apple tv plus' || s === 'mls season pass' || s === 'apple tv mls') return 'Apple TV';
  if (s.includes('amazon prime') || s.includes('prime video')) return 'Prime Video';
  if (s.includes('paramount')) return 'Paramount+';
  if (s === 'hbo max' || s === 'max') return 'HBO Max';
  if (/^sportv(?: [1-9])?$/.test(s)) return s === 'sportv' ? 'SporTV' : `SporTV ${s.split(' ')[1]}`;
  if (s === 'premiere fc' || s === 'premiere clubes') return 'Premiere';
  if (/^premiere(?: [1-9]| 10)?$/.test(s)) return s === 'premiere' ? 'Premiere' : `Premiere ${s.split(' ')[1]}`;
  if (/^espn(?: [1-9])?$/.test(s)) return s.toUpperCase();
  if (s === 'xsports' || s === 'x sports') return 'X Sports';
  if (s === 'nsports' || s === 'n sports') return 'N Sports';
  if (s === 'sportynet' || s === 'sporty net') return 'SportyNet';
  if (s === 'bandsports' || s === 'band sports') return 'BandSports';
  if (s === 'ge tv' || s === 'getv') return 'GE TV';
  if (s === 'canal goat' || s === 'goat') return 'Canal GOAT';
  if (s.includes('caze')) return 'CazéTV';
  if (/^(?:tv |rede )?record(?: tv)?$/.test(s)) return 'Record TV';
  if (/^(?:tv |rede )?band(?: tv)?$/.test(s)) return 'Band';
  if (s === 'sbt' || s === 'tv sbt') return 'SBT';
  if (s === 'redetv' || s === 'rede tv') return 'RedeTV!';
  if (/^(?:(?:tv|rede|canal) )?globo(?: (?:rj|sp|mg|df|rs|ba|pe|pr|sc|ce|am|pa|go|es|pb|rn|al|se|pi|ma|mt|ms|ro|rr|ap|ac|to|regional|nacional|brasil))?$/.test(s) || /^(?:rede globo de televisao|tv globo rede|globo tv|globoplay tv globo)$/.test(s)) return 'Globo';
  if (s === 'sportv extra') return 'SporTV Extra';
  if (s === 'sportv 4k') return 'SporTV 4K';
  if (s === 'tnt') return 'TNT';
  if (s === 'space') return 'Space';
  return null;
}
const sofaIds = SOFASCORE_CHANNELS;
// SOFA_CHANNEL_IDS: JSON, por exemplo {"123":"Premiere 2"}.
function sofaMap(env) {try {return {...sofaIds,...JSON.parse(env.SOFA_CHANNEL_IDS || '{}')};} catch {return sofaIds;}}
async function getJson(url, headers = {}) {
  const r = await fetch(url, {headers, signal:AbortSignal.timeout(14000)});
  if (!r.ok) throw Error(`HTTP ${r.status}: ${url}`);
  return r.json();
}
async function sofaJson(env,url) {
  if (!env.SCRAPERAPI_KEY) throw new Error('SCRAPERAPI_KEY ausente no ambiente de produção');
  const api = new URL('https://api.scraperapi.com/');
  api.searchParams.set('api_key',env.SCRAPERAPI_KEY);
  api.searchParams.set('url',url);
  // Não incluir URL com chave nos logs de erro.
  const r=await fetch(api.toString(),{signal:AbortSignal.timeout(14000)});
  if(!r.ok)throw new Error(`ScraperAPI HTTP ${r.status} ao consultar SofaScore`);
  try{return await r.json();}catch{throw new Error('Resposta não JSON do SofaScore');}
}
// SofaScore complementa o FotMob: nunca apaga canais de outras emissoras.
// IDs adicionais podem ser cadastrados em SOFA_CHANNEL_IDS no Cloudflare.
const tvFamily = c => /^premiere(?: (?:[1-9]|10))?$/i.test(c) ? 'Premiere'
  : /^sportv(?: [1-4])?$/i.test(c) ? 'SporTV' : null;
function mergeTvChannels(original, found) {
  const result=[...new Set(original)];
  const valid=[...new Set(found.map(channelName).filter(Boolean))];
  for(const family of ['Premiere','SporTV']) {
    const specific=valid.filter(c=>tvFamily(c)===family && c!==family);
    if(specific.length) {
      const idx=result.indexOf(family);
      if(idx>=0) result.splice(idx,1);
      for(const c of specific) if(!result.includes(c)) result.push(c);
    } else if(valid.includes(family) && !result.some(c=>tvFamily(c)===family)) result.push(family);
  }
  // Outros canais que o SofaScore identifica não substituem os do FotMob.
  for(const c of valid) if(!tvFamily(c)&&!result.includes(c))result.push(c);
  return result;
}
function sofaEntities(data) {
  return (data?.results||[]).map(r=>r?.entity||r).filter(Boolean);
}
function sofaCandidate(m,event) {
  const home=m.homeTeam?.name||'',away=m.awayTeam?.name||'';
  const expected=Date.parse(event.utcTime),time=Number(m.startTimestamp)*1000;
  return teamSimilarity(home,event.home)>=.75&&teamSimilarity(away,event.away)>=.75&&
    Number.isFinite(time)&&Math.abs(time-expected)<=6*3600000;
}
async function findSofaEvent(env,event) {
  const queries=[`${event.home} ${event.away}`,event.home];
  for(const q of queries){
    const search=await sofaJson(env,`https://www.sofascore.com/api/v1/search/all?q=${encodeURIComponent(q)}&page=0`);
    const entries=sofaEntities(search);
    const direct=entries.find(m=>m.id&&sofaCandidate(m,event));
    if(direct)return direct;
    const teams=entries.filter(e=>e.id&&teamSimilarity(e.name,event.home)>=.75&&
      (e.type==='team'||e.sport?.slug==='football'||e.name));
    for(const team of teams.slice(0,2)){
      for(const period of ['next','last']){
        try{
          const data=await sofaJson(env,`https://www.sofascore.com/api/v1/team/${team.id}/events/${period}/0`);
          const match=(data?.events||[]).find(m=>sofaCandidate(m,event));
          if(match)return match;
        }catch(err){console.warn('[EVENTS SOFA TEAM]',period,err.message);}
      }
    }
  }
  return null;
}
function extractBrazilChannels(data) {
  const cc=data?.countryChannels;
  let raw=cc?.BR??cc?.br??cc?.Brazil??data?.channels??[];
  if(Array.isArray(cc)){
    const br=cc.find(c=>['BR','br','Brazil'].includes(c.countryCode||c.country||c.code));
    raw=br?.channels??br?.channelIds??raw;
  }
  if(!Array.isArray(raw)&&raw&&typeof raw==='object')raw=raw.channels??raw.ids??[];
  return Array.isArray(raw)?raw:[];
}
function extractChannel(item,mapping){
  if(typeof item==='string'&& !/^\d+$/.test(item))return channelName(item);
  const id=typeof item==='object'?(item.id??item.channelId??item.tvChannelId):item;
  const name=typeof item==='object'?(item.name||item.channelName||item.tvChannel?.name||item.channel?.name):null;
  return channelName(name||mapping[id]);
}
// Busca por programa, sem varrer todas as grades. Resultados sao reutilizados
// entre partidas da mesma requisicao e entre requisicoes do mesmo worker.
const guideSearchCache = new Map();
const guideProxyBase = env => (env.GUIDE_PROXY_ORIGIN || 'https://nacaumtv.pages.dev').replace(/\/$/, '');
function decodeGuide(s) {
  return String(s||'').replace(/&(?:nbsp|#160);/gi,' ').replace(/&amp;/gi,'&')
    .replace(/&(?:times|#215);/gi,' x ').replace(/&quot;/gi,'"')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,h,d)=>String.fromCodePoint(parseInt(h||d,h?16:10)))
    .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}
function guideSearchPrograms(html) {
  const results=[];
  // O Guia retorna cada programa como link /programa/... seguido do link /canal/...
  const re=/<a\b[^>]*href=["']([^"']*\/programa\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(html))) {
    const title=decodeGuide(m[2]);
    const next=html.slice(re.lastIndex,re.lastIndex+1800);
    const channel=next.match(/<a\b[^>]*href=["']([^"']*\/canal\/([a-z0-9-]+)[^"']*)["'][^>]*>/i);
    if(!channel)continue;
    const slug=channel[2].toLowerCase();
    const name=channelName(slug.replace(/-/g,' '));
    if(!name)continue;
    // O horario aparece antes do link do programa, normalmente junto do "Ao vivo".
    const before=decodeGuide(html.slice(Math.max(0,m.index-550),m.index));
    const times=[...before.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)];
    const last=times.at(-1);
    const minute=last?Number(last[1])*60+Number(last[2]):null;
    const live=/\bao vivo\b/i.test(before.slice(-90));
    results.push({title,channel:name,slug,minute,live});
  }
  return results;
}
function guideTeamKey(raw) {
  return normalize(raw).replace(/\bathletico(?: paranaense| pr)?\b/g,'athletico')
    .replace(/\batletico pr\b/g,'athletico')
    .replace(/\b(?:fc|sc|ec|clube|club|futebol|de|do|da|pr|rj|sp|rs|mg|ba|pe|ce|go)\b/g,' ')
    .replace(/\s+/g,' ').trim();
}
function guideSameTeam(a,b) {
  const x=guideTeamKey(a),y=guideTeamKey(b);
  if(!x||!y)return false;
  if(x===y)return true;
  const xw=x.split(' ').filter(w=>w.length>=4),yw=y.split(' ').filter(w=>w.length>=4);
  return xw.some(w=>yw.includes(w)) && (xw.length===1||yw.length===1||teamSimilarity(a,b)>=.75);
}
function guideProgramMatches(program,event) {
  const title=normalize(program.title);
  if(/\b(vt|reprise|melhores momentos|compacto|melhores gols|pre jogo|pre hora|aquecimento)\b/.test(title))return false;
  // "Hoje a partir das 21:30 - ..." e "Dia 23/11 - ..." sao anuncios,
  // nao a transmissao ao vivo; nao os usamos como confirmacao.
  if(/^(?:hoje a partir|dia \d{1,2}|amanha a partir)/.test(title))return false;
  const parts=program.title.replace(/[×]/g,' x ').split(/\s+x\s+/i);
  if(parts.length!==2)return false;
  const left=parts[0].replace(/^.*?:\s*/,'').trim();
  const right=parts[1].replace(/\s+ao vivo.*$/i,'').trim();
  if(!((guideSameTeam(left,event.home)&&guideSameTeam(right,event.away)) ||
        (guideSameTeam(left,event.away)&&guideSameTeam(right,event.home))))return false;
  const expected=new Date(event.utcTime).toLocaleTimeString('pt-BR',{timeZone:TZ,hour:'2-digit',minute:'2-digit'});
  const minute=Number(expected.slice(0,2))*60+Number(expected.slice(3));
  // O horario da busca e a partida devem coincidir. Se o HTML nao expuser
  // o horario, so aceitamos quando o resultado estiver marcado Ao vivo.
  return program.minute===null?program.live:Math.abs(program.minute-minute)<=30;
}
function guideQueries(event) {
  const h=guideTeamKey(event.home),a=guideTeamKey(event.away);
  const terms=[`${h} x ${a}`,h,a];
  // Busca progressiva: nome completo, nome curto, prefixos maiores primeiro.
  for(const name of [h,a]) {
    const first=name.split(' ')[0];
    if(first&&first!==name)terms.push(first);
    if(first.length>5)terms.push(first.slice(0,5));
    if(first.length>4)terms.push(first.slice(0,4));
    if(first.length>3)terms.push(first.slice(0,3));
  }
  return [...new Set(terms.filter(x=>x.length>=3))];
}
async function fetchGuideSearch(env,term) {
  const key=normalize(term);
  const cached=guideSearchCache.get(key);
  if(cached&&Date.now()-cached.at<10*60*1000)return cached.programs;
  const source=`https://www.guiadetv.com/busca?q=${encodeURIComponent(term)}`;
  let error;
  for(const route of ['/api/proxy','/api/proxy2']) {
    try {
      const url=`${guideProxyBase(env)}${route}?url=${encodeURIComponent(source)}`;
      const r=await fetch(url,{signal:AbortSignal.timeout(12000)});
      const html=await r.text();
      if(!r.ok)throw Error(`HTTP ${r.status}`);
      if(!/\/programa\/|programas encontrados|nenhum programa|nenhum resultado/i.test(html))throw Error('HTML da busca inesperado');
      const programs=guideSearchPrograms(html);
      console.log('[EVENTS GUIDE SEARCH RESPONSE]',JSON.stringify({query:term,route,status:r.status,bytes:html.length,parsed:programs.length,preview:programs.slice(0,15)}));
      guideSearchCache.set(key,{at:Date.now(),programs});
      if(guideSearchCache.size>100)guideSearchCache.delete(guideSearchCache.keys().next().value);
      return programs;
    }catch(e){error=e;console.warn('[EVENTS GUIDE SEARCH ERROR]',term,route,e.message);}
  }
  throw error||Error('Busca indisponivel');
}
async function enrichGuideSearch(env,event) {
  const required=['Premiere','SporTV'].filter(f=>event.channels.includes(f));
  const found=new Set();
  for(const query of guideQueries(event)) {
    let programs;
    try {programs=await fetchGuideSearch(env,query);}
    catch(e){continue;}
    const hits=programs.filter(p=>guideProgramMatches(p,event));
    for(const hit of hits) {
      if(required.includes(tvFamily(hit.channel)))found.add(hit.channel);
    }
    console.log('[EVENTS GUIDE SEARCH MATCH]',JSON.stringify({match:`${event.home} x ${event.away}`,query,hits,found:[...found]}));
    if(required.every(f=>[...found].some(c=>tvFamily(c)===f)))break;
  }
  // Uma variante encontrada na busca e conclusiva para aquela familia.
  // FotMob continua sendo a origem dos outros canais.
  for(const family of required) {
    const channels=[...found].filter(c=>tvFamily(c)===family);
    if(channels.length) {
      event.channels=event.channels.filter(c=>tvFamily(c)!==family);
      event.channels.push(...channels);
    }
  }
  console.log('[EVENTS GUIDE SEARCH RESULT]',JSON.stringify({match:`${event.home} x ${event.away}`,found:[...found],missing:required.filter(f=>![...found].some(c=>tvFamily(c)===f))}));
  return required.filter(f=>![...found].some(c=>tvFamily(c)===f));
}
async function enrichSofa(env,event,missingFamilies=[]) {
  if(!event.channels.some(c=>c==='SporTV'||c==='Premiere'))return event;
  try {
    const match=await findSofaEvent(env,event);
    if(!match){console.warn('[EVENTS SOFA NOT FOUND]',event.home,'x',event.away);return event;}
    const data=await sofaJson(env,`https://www.sofascore.com/api/v1/tv/event/${match.id}/country-channels`);
    const raw=extractBrazilChannels(data),mapping=sofaMap(env);
    const precise=raw.map(item=>extractChannel(item,mapping)).filter(Boolean);
    const unknown=raw.filter(item=>!extractChannel(item,mapping)).map(item=>
      typeof item==='object'?(item.id??item.channelId??item.name??'objeto'):item);
    console.log('[EVENTS SOFA CHANNELS]',JSON.stringify({
      match:`${event.home} x ${event.away}`,sofaEventId:match.id,
      channelCount:raw.length,recognized:precise,unmapped:unknown
    }));
    // Nao sobrescreve canais que o Guia de TV ja confirmou.
    const allowed=precise.filter(c=>!tvFamily(c)||missingFamilies.includes(tvFamily(c)));
    event.channels=mergeTvChannels(event.channels,allowed);
  }catch(e){console.warn('[EVENTS SOFA ERROR]',event.home,'x',event.away,e.message);}
  return event;
}
async function enrichMany(env,events) {
  const queue=events.filter(e=>e.channels.some(c=>c==='SporTV'||c==='Premiere'));
  await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{
    while(queue.length) {
      const event=queue.shift();
      const missing=await enrichGuideSearch(env,event);
      if(missing.length&&env.SCRAPERAPI_KEY)await enrichSofa(env,event,missing);
    }
  }));
}
function flatten(data,date) {
  const result=[];
  for (const leagues of Object.values(data || {})) for (const league of leagues || []) for (const m of league.matches || []) {
    if (!m.utcTime || localDate(m.utcTime)!==date) continue;
    const names=[...new Set((m.channels||[]).map(c=>channelName(typeof c==='string'?c:(c.name||c.channelName||c.title||c.tvChannel?.name))).filter(Boolean))];
    if (!names.length) continue;
    result.push({id:String(m.id),home:m.home?.name||'',away:m.away?.name||'',homeTeamId:m.home?.id??null,awayTeamId:m.away?.id??null,homeLogo:teamLogo(m.home?.id),awayLogo:teamLogo(m.away?.id),league:m.leagueName||league.leagueName||'',utcTime:m.utcTime,channels:names,status:'scheduled',score:null});
  }
  return result;
}
async function fetchFotmob(env) {
  try {return await getJson(FOTMOB);}
  catch (directError) {
    if (!env.SCRAPERAPI_KEY) throw new Error(`FotMob direto falhou (${directError.message}); configure SCRAPERAPI_KEY na Cloudflare.`);
    const api=new URL('https://api.scraperapi.com/');
    api.searchParams.set('api_key',env.SCRAPERAPI_KEY);
    api.searchParams.set('url',FOTMOB);
    try {return await getJson(api.toString());}
    catch (proxyError) {throw new Error(`FotMob direto: ${directError.message}; ScraperAPI: ${proxyError.message.replace(/api_key=[^&]+/,'api_key=[redacted]')}`);}
  }
}
async function snapshot(env,date) {
  const data=await fetchFotmob(env);
  const events=flatten(data,date);
  await enrichMany(env,events);
  await env.DB.prepare('INSERT INTO event_snapshots (day,events,updated_at) VALUES (?,?,?) ON CONFLICT(day) DO UPDATE SET events=excluded.events, updated_at=excluded.updated_at').bind(date,JSON.stringify(events),Date.now()).run();
  return events;
}

// Executado por agendamento independente da página /eventos.
export async function ensureDailySnapshot(env) {
  if (!env.DB) throw new Error('DB (D1) não configurado');
  const day=today();
  const existing=await env.DB.prepare('SELECT events FROM event_snapshots WHERE day=?').bind(day).first();
  if (existing) return {day,created:false,count:JSON.parse(existing.events).length};
  const events=await snapshot(env,day);
  console.log('[EVENTS DAILY SNAPSHOT]',JSON.stringify({day,created:true,count:events.length}));
  return {day,created:true,count:events.length};
}

// Futbol24: placar em tempo real, com busca quando o jogo não aparece no in_play.
const FUTBOL_HEADERS={Accept:'application/json, text/plain, */*',Referer:'https://www.futbol24.com/pt/','User-Agent':'Mozilla/5.0 (compatible; NacaumTV/1.0)'};
const clean=s=>normalize(s).replace(/\b(fc|cf|sc|ac|club|clube|de|do|da|the|futebol|football)\b/g,' ').replace(/\s+/g,' ').trim();
const alias=s=>clean(s)
  .replace(/\bmanchester utd\b/g,'manchester united')
  .replace(/\binter rs\b|\binter de porto alegre\b/g,'internacional')
  .replace(/\b(women|feminino|feminina)\b/g,'w')
  .replace(/\b(sc|fc|cf|ac|al|ce|go|mt|pe|sp|rj|rs|mg|ba|pr|pb|rn|pa|df|es|se|ma|pi|to|am|ap|ro|rr)\b/g,' ')
  .replace(/\s+/g,' ').trim();
function teamSimilarity(a,b) {
  const x=alias(a),y=alias(b);
  if (!x||!y) return 0;
  if (x===y) return 1;
  const xw=x.split(' '),yw=y.split(' ');
  const common=xw.filter(t=>yw.includes(t));
  const overlap=common.length/Math.max(xw.length,yw.length);
  if (overlap>=.75) return .85;
  if (xw.length>=2&&yw.length>=2&&common.length>=2&&overlap>=.5) return .76;
  return 0;
}
function namesOf(m) {return [m?.team1?.name||m?.team1?.name_short||m?.home?.name||m?.home,m?.team2?.name||m?.team2?.name_short||m?.away?.name||m?.away];}
function slugNames(slug) {const parts=String(slug||'').split('/');const i=parts.indexOf('vs');return i>0&&i<parts.length-1?[parts[i-1].replace(/-/g,' '),parts[i+1].replace(/-/g,' ')]:['',''];}
function matchQuality(m,e,slug) {const [home,away]=namesOf(m);const [sh,sa]=slugNames(slug||m?.slug);const pairs=[[home,away],[m?.team1?.name_short,m?.team2?.name_short],[sh,sa]];return Math.max(...pairs.map(([h,a])=>Math.min(teamSimilarity(h,e.home),teamSimilarity(a,e.away))));}
function parseScore(m) {const raw=m?.score1??m?.score??null;const value=typeof raw==='string'?raw:(Array.isArray(raw)?raw.join('-'):'');const result=value.match(/(\d+)\s*[-:x×]\s*(\d+)/i);if(result)return `${result[1]} - ${result[2]}`;if(Number.isInteger(m?.homeScore)&&Number.isInteger(m?.awayScore))return `${m.homeScore} - ${m.awayScore}`;return null;}
function isEnded(m) {const status=m?.status||{};const name=normalize(typeof status==='object'?(status.name_short||status.name):status);return status.is_ended===true||m?.is_ended===true||m?.finished===true||/^(ft|aet|ap|finished|full time|final|ended|encerrado)$/.test(name);}
function isLive(m) {return m?.status?.in_play===true||m?.in_play===true;}
function matchDay(m,e) {const target=Date.parse(e.utcTime),actual=Date.parse(m?.date||m?.utcTime||'');if(!Number.isFinite(target)||!Number.isFinite(actual))return false;return Math.abs(target-actual)<=18*3600000&&localDate(m.date||m.utcTime)===localDate(e.utcTime);}
function fallbackQuality(m,e) {
  const [home,away]=namesOf(m);
  const [sh,sa]=slugNames(m?.slug);
  const teamHit=(a,b)=>{
    const x=alias(a),y=alias(b);
    if(!x||!y)return false;
    if(x===y||x.includes(y)||y.includes(x))return true;
    const aWords=x.split(' ').filter(w=>w.length>=4),bWords=y.split(' ').filter(w=>w.length>=4);
    return aWords.some(w=>bWords.includes(w));
  };
  return Math.max(Number(teamHit(home,e.home))+Number(teamHit(away,e.away)),Number(teamHit(sh,e.home))+Number(teamHit(sa,e.away)));
}
function bestSearchMatch(rows,e) {
  const candidates=(Array.isArray(rows)?rows:rows?.matches||rows?.results||[])
    .filter(m=>matchDay(m,e))
    .map(m=>({m,quality:matchQuality(m,e),hits:fallbackQuality(m,e),delta:Math.abs(Date.parse(m.date||m.utcTime)-Date.parse(e.utcTime))}));
  const exact=candidates.filter(x=>x.quality>=.72).sort((a,b)=>b.quality-a.quality||a.delta-b.delta)[0];
  if(exact)return exact.m;
  const fallback=candidates.filter(x=>(isLive(x.m)||isEnded(x.m))&&x.hits>=1&&x.delta<=15*60000)
    .sort((a,b)=>b.hits-a.hits||a.delta-b.delta);
  if(fallback.length&&!(fallback[0].hits===1&&fallback[1]&&fallback[1].hits===1&&fallback[1].delta===fallback[0].delta))return fallback[0].m;
  return null;
}
function applyMatch(e,m,liveEntry) {
  if(!m)return;
  const score=parseScore(m)||parseScore(liveEntry);
  if(score&&(isEnded(m)||isLive(m)||isLive(liveEntry)||e.status!=='live'))e.score=score;
  if(m.slug)e.futbolSlug=m.slug;
  if(m.id)e.futbolId=m.id;
  e._missingPolls=0;
  if(isEnded(m)){e.status='finished';e.minute=null;e._seenLive=true;return;}
  if(isLive(m)||isLive(liveEntry)){e.status='live';e._seenLive=true;e.minute=liveEntry?.minute??liveEntry?.time??m.minute??m.time??null;return;}
  if(e.status!=='live'&&e.status!=='finished')e.status='scheduled';
}
async function futbolJson(url) {return getJson(url,FUTBOL_HEADERS);}
async function searchMatch(e) {
  const queries=[e.home,`${e.home} ${e.away}`,e.away,`${e.away} ${e.home}`];
  for(const q of [...new Set(queries)]) {
    const url=`https://www.futbol24.com/api/search/match?query=${encodeURIComponent(q)}`;
    try {const data=await futbolJson(url);const match=bestSearchMatch(data,e);if(match)return match;}
    catch(error){console.warn('[FUTBOL24 SEARCH ERROR]',e.home,e.away,q,error?.message);}
  }
  return null;
}
function liveEntries(data) {
  const raw=data?.inplay?.matches??data?.in_play?.matches??data?.matches??data?.inplay??data?.in_play??{};
  if(Array.isArray(raw))return raw.map(m=>[m?.slug||'',m]);
  if(raw&&typeof raw==='object')return Object.entries(raw).flatMap(([slug,value])=>{
    if(Array.isArray(value))return value.map(m=>[m?.slug||slug,m]);
    return value&&typeof value==='object'?[[slug,value]]:[];
  });
  return [];
}
async function monitor(events) {
  const now=Date.now();
  const active=events.filter(e=>e.status!=='finished'&&Number.isFinite(Date.parse(e.utcTime))&&Date.parse(e.utcTime)<=now+60000);
  if(!active.length)return events;
  let entries=[];
  try {const data=await futbolJson(`https://www.futbol24.com/api/in_play?_=${now}`);entries=liveEntries(data);}
  catch(error){console.warn('[FUTBOL24 IN_PLAY]',error.message);}
  const unresolved=[];
  for(const e of active) {
    const matches=entries.map(([slug,m])=>({slug,m,quality:matchQuality(m,e,slug)})).filter(x=>x.quality>=.72).sort((a,b)=>b.quality-a.quality);
    const live=matches[0];
    if(live){const m={...live.m,slug:live.slug||live.m.slug};applyMatch(e,m,live.m);if(isLive(live.m)||isEnded(live.m))continue;}
    if(now-Date.parse(e.utcTime)<=18*3600000)unresolved.push(e);
  }
  const workers=Array.from({length:Math.min(4,unresolved.length)},async()=>{
    while(unresolved.length){
      const e=unresolved.shift();
      try {
        const found=await searchMatch(e);
        if(!found){console.warn('[FUTBOL24 UNMATCHED]',e.home,e.away,e.utcTime);continue;}
        const entry=entries.find(([slug,m])=>String(slug)===String(found.slug)||String(m?.id)===String(found.id));
        applyMatch(e,found,entry?.[1]);
      }catch(error){console.warn('[FUTBOL24 MONITOR]',e.home,e.away,error.message);}
    }
  });
  await Promise.all(workers);
  return events;
}
export async function onRequestGet({env}) {
  if(!env.DB)return Response.json({error:'Vincule o D1 com o nome DB.'},{status:503});
  try {
    const day=today();
    let row=await env.DB.prepare('SELECT events FROM event_snapshots WHERE day=?').bind(day).first();
    if(!row){await ensureDailySnapshot(env);row=await env.DB.prepare('SELECT events FROM event_snapshots WHERE day=?').bind(day).first();}
    const saved=JSON.parse(row.events);
    // Corrige os nomes de canais já gravados no D1, sem perder status ou placares.
    for(const e of saved){e.channels=[...new Set((e.channels||[]).map(c=>channelName(c)||c))];}
    const refreshDue=saved.some(e=>!e._tvNamesV7||!e._tvCheckedAt||Date.now()-e._tvCheckedAt>6*3600000);
    if(refreshDue){
      try {
        const fresh=flatten(await fetchFotmob(env),day);
        const byId=new Map(fresh.map(e=>[String(e.id),e]));
        for(const e of saved){
          const current=byId.get(String(e.id));
          if(current)e.channels=current.channels;
          e._tvNamesV7=true;
          e._tvCheckedAt=Date.now();
        }
        await enrichMany(env,saved);
      }catch(error){console.warn('[EVENTS TV CHANNEL REFRESH]',error.message);}
    }
    const events=await monitor(saved);
    await env.DB.prepare('UPDATE event_snapshots SET events=? WHERE day=?').bind(JSON.stringify(events),day).run();
    return Response.json({date:day,events},{headers:{'Cache-Control':'no-store'}});
  }catch(e){console.error('[EVENTS]',e);return Response.json({error:'Não foi possível atualizar os eventos.',detail:e.message},{status:502});}
}
