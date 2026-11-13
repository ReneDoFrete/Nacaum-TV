const ORIGIN='https://filmes-saimo.pages.dev';
const TMDB='https://api.themoviedb.org/3';
const json=(value,status=200,ttl=300)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':`public, max-age=${ttl}`}});
const clean=s=>String(s||'').trim();
const safeId=s=>/^[0-9]+$/.test(String(s||''))?String(s):null;
const normalize=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const isUrl=s=>/^https?:\/\//i.test(s);
function movieLine(line,i){
 const [title,...fields]=line.split('\t');if(!clean(title)||title.startsWith('#'))return null;
 const sources={dub:[],leg:[]};for(const f of fields){const m=f.match(/^(dub|leg)=(.*)$/i);if(m)sources[m[1].toLowerCase()].push(...m[2].split(',').map(clean).filter(isUrl));}
 const match=fields.join(' ').match(/[?&]id=(\d+)/);return {key:`movie-${i}`,title:clean(title),tmdbId:match?Number(match[1]):null,type:'movie',hasDub:!!sources.dub.length,hasLeg:!!sources.leg.length,sources};
}
function seriesLine(line,i){
 const [title,year,...extra]=line.split('\t');if(!clean(title)||title.startsWith('#'))return null;
 const match=line.match(/[?&]id=(\d+)/);return {key:`tv-${i}`,title:clean(title),year:/^\d{4}$/.test(year)?year:'',tmdbId:match?Number(match[1]):null,type:'tv',hasDub:false,hasLeg:false,sources:{dub:[],leg:[]}};
}
function episodeRows(raw){
 let current=null;const groups=[];
 for(const line of raw.split(/\r?\n/)){
  if(line.startsWith('@')){const fields=line.slice(1).split('\t');current={title:clean(fields[0]),year:clean(fields[1]),tmdbId:clean(fields[2]),episodes:[]};groups.push(current);continue;}
  if(!current)continue;
  const f=line.split('\t');if(f.length<4)continue;
  const season=Number(f[0]),episode=Number(f[1]),lang=clean(f[2]).toLowerCase(),url=clean(f.slice(3).join('\t'));
  if(!Number.isInteger(season)||!Number.isInteger(episode)||!['dub','leg'].includes(lang)||!url)continue;
  let ep=current.episodes.find(x=>x.season===season&&x.episode===episode);
  if(!ep){ep={season,episode,sources:{dub:[],leg:[]}};current.episodes.push(ep)}ep.sources[lang].push(...url.split(',').map(clean).filter(isUrl));
 }
 return groups;
}
function supplemental(raw,category){
 const result=[];let n=0;
 for(const line of raw.split(/\r?\n/)){
  if(!line.trim()||line.startsWith('#'))continue;
  const f=line.split('\t');let title=clean(f[0]).replace(/^@/,'');if(!title)continue;
  const urls=(line.match(/https?:\/\/[^\s,]+/g)||[]);
  const m=line.match(/[?&]id=(\d+)/);
  if(!urls.length&&!/^[^\t]+\t/.test(line))continue;
  result.push({key:`${category}-${n++}`,title,tmdbId:m?Number(m[1]):null,type:'tv',hasDub:false,hasLeg:false,sources:{dub:[],leg:[]}});
 }
 return result;
}
// Arquivos especializados: cada cabeçalho @ representa um título (não um episódio).
const specializedCache=new Map();
async function specializedCatalog(category){
 const cached=specializedCache.get(category);
 if(cached&&Date.now()-cached.at<15*60*1000)return cached.items;
 const raw=await fetchTxt(`redeflix/links-${category==='anime'?'animes':'doramas'}.txt?v=29908719`);
 const items=[];let current=null;
 for(const line of raw.split(/\r?\n/)){
  if(!line.startsWith('@'))continue;
  const fields=line.slice(1).split('\t');const title=clean(fields[0]);if(!title)continue;
  const year=/^(?:19|20)\d{2}$/.test(clean(fields[1]))?clean(fields[1]):'';
  const tmdbId=safeId(clean(fields[2]));
  current={key:`${category}-${items.length}`,title,year,tmdbId:tmdbId?Number(tmdbId):null,type:'tv',category,hasDub:false,hasLeg:false,sources:{dub:[],leg:[]}};
  items.push(current);
 }
 specializedCache.set(category,{at:Date.now(),items});return items;
}
function findSpecializedEpisodes(raw,title,year,id){
 const groups=episodeRows(raw);const target=normalize(title);const dated=year?normalize(`${title} ${year}`):null;
 // Prefere identificação TMDB, depois título exato e por fim título + ano.
 const idMatch=id?groups.find(g=>g.tmdbId===String(id)):null;
 return idMatch||groups.find(g=>normalize(g.title)===target)||groups.find(g=>dated&&normalize(g.title)===dated)||null;
}
const fetchTxt=async(path)=>{const r=await fetch(`${ORIGIN}/${path}`,{cf:{cacheTtl:1200,cacheEverything:true}});if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);const raw=await r.text();if(/^\s*</.test(raw))throw new Error(`${path}: HTML inesperado`);return raw};
const paths={anime:'redeflix/links-animes.txt',series:'redeflix/links-series.txt',dorama:'redeflix/links-doramas.txt'};
export async function onRequestGet({request,env={}}){
 const u=new URL(request.url),p=u.searchParams;const key=env.TMDB_API_KEY,token=env.TMDB_READ_TOKEN;
 try{
  if(p.has('letter')||p.has('category')||p.has('episodes')){
   const letter=clean(p.get('letter')||'A').toUpperCase();const category=clean(p.get('category')||'movie').toLowerCase();
   if(!/^(?:[A-Z]|#)$/.test(letter))return json({error:'Letra inválida'},400);
   if(!['movie','series','anime','dorama'].includes(category))return json({error:'Categoria inválida'},400);
   if(category==='anime'||category==='dorama'){
    if(p.has('episodes')){
     const title=clean(p.get('episodes'));const year=clean(p.get('year'));const id=safeId(p.get('tmdbId'));
     const raw=await fetchTxt(`redeflix/links-${category==='anime'?'animes':'doramas'}.txt?v=29908719`);
     const found=findSpecializedEpisodes(raw,title,year,id);
     return json({title,matchedTitle:found?.title||null,episodes:found?.episodes||[],found:!!found},200,600);
    }
    const items=await specializedCatalog(category);
    return json({category,count:items.length,items},200,900);
   }
   if(p.has('episodes')){
    const title=clean(p.get('episodes'));if(!title)return json({error:'Informe o título'},400);
    const year=clean(p.get('year'));const validYear=/^(?:19|20)\d{2}$/.test(year)?year:'';
    const initial=clean(title).normalize('NFD').replace(/[\u0300-\u036f]/g,'').charAt(0).toUpperCase();
    const bucket=/^[A-Z]$/.test(initial)?initial:'%23';
    // Procura em 0..11, interrompendo ao encontrar o título exato.
    // Cache HTTP reduz novas consultas ao catálogo remoto.
    let match=null;const target=normalize(title);const datedTarget=validYear?normalize(`${title} ${validYear}`):null;
    let datedMatch=null;
    for(let n=0;n<=11;n++){
      let raw;
      try{raw=await fetchTxt(`series-${bucket}-${n}.txt`)}catch(e){continue}
      const groups=episodeRows(raw);
      // Primeiro, título exato. Caso não exista, tenta título + ano,
      // como 'Lupin' no índice e '@Lupin 2021' no arquivo de episódios.
      match=groups.find(g=>normalize(g.title)===target);
      if(match)break;
      if(datedTarget&&!datedMatch)datedMatch=groups.find(g=>normalize(g.title)===datedTarget);
    }
    match ||= datedMatch;
    return json({title,matchedTitle:match?.title||null,episodes:match?.episodes||[],found:!!match},200,900);
   }
   let raw,items=[];
   if(category==='movie'){raw=await fetchTxt(`filmes-${letter==='#'?'%23':letter}.txt`);items=raw.split(/\r?\n/).map(movieLine).filter(Boolean)}
   else if(category==='series'){
    raw=await fetchTxt(`series-${letter==='#'?'A':letter}.txt`);items=raw.split(/\r?\n/).map(seriesLine).filter(Boolean);
   }else{
    raw=await fetchTxt(paths[category]);items=supplemental(raw,category);
    // Fallback to the general series index if the specialized list cannot be parsed.
   }
   return json({category,letter,count:items.length,items},200,900);
  }
  if(!key&&!token)return json({error:'Configure TMDB_API_KEY ou TMDB_READ_TOKEN'},503);
  const type=p.get('type')==='tv'?'tv':'movie';let endpoint;
  if(p.has('id')){const id=safeId(p.get('id'));if(!id)return json({error:'ID inválido'},400);endpoint=`/${type}/${id}?language=pt-BR&append_to_response=credits,${type==='tv'?'content_ratings':'release_dates'}`}
  else if(p.has('search')){const q=clean(p.get('search')).slice(0,100);endpoint=`/search/${type}?language=pt-BR&query=${encodeURIComponent(q)}`}
  else if(p.has('season')){const id=safeId(p.get('tvId')),season=safeId(p.get('season'));if(!id||!season)return json({error:'Temporada inválida'},400);endpoint=`/tv/${id}/season/${season}?language=pt-BR`}
  else return json({error:'Use category, letter, episodes, id, search ou season'},400);
  const url=`${TMDB}${endpoint}${key?`&api_key=${encodeURIComponent(key)}`:''}`;
  const r=await fetch(url,{headers:token?{Authorization:`Bearer ${token}`}:{},cf:{cacheTtl:86400,cacheEverything:true}});
  if(!r.ok)return json({error:'Erro TMDB',status:r.status},r.status);
  return json(await r.json(),200,86400);
 }catch(e){return json({error:e.message||'Erro ao consultar catálogo'},502)}
}
