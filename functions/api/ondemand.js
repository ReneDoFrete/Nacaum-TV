// Cloudflare Pages Function: GET /api/ondemand?letter=A | ?id=1437511 | ?search=...
const ORIGIN = 'https://filmes-saimo.pages.dev';
const TMDB = 'https://api.themoviedb.org/3';
const json = (data,status=200,cache=300) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':`public, max-age=${cache}`,'access-control-allow-origin':'*'}});
function parseLine(line,index){
 const [name,...fields] = line.split('\t');
 if(!name?.trim())return null;
 const sources={dub:[],leg:[]};
 for(const field of fields){const m=field.match(/^(dub|leg)=(.*)$/i);if(m) sources[m[1].toLowerCase()].push(...m[2].split(',').map(x=>x.trim()).filter(x=>/^https?:\/\//.test(x)));}
 const id=fields.join(' ').match(/[?&]id=(\d+)/)?.[1]||null;
 return {key:index,title:name.trim(),tmdbId:id?Number(id):null,hasDub:sources.dub.length>0,hasLeg:sources.leg.length>0,sources};
}
export async function onRequestGet({request,env}){
 const u=new URL(request.url);const key=env.TMDB_API_KEY;const token=env.TMDB_READ_TOKEN;
 try{
  if(u.searchParams.has('letter')){
   const letter=(u.searchParams.get('letter')||'A').toUpperCase();
   if(!/^[A-Z]$/.test(letter))return json({error:'Letra inválida'},400);
   const r=await fetch(`${ORIGIN}/filmes-${letter}.txt`,{cf:{cacheTtl:900,cacheEverything:true}});
   if(!r.ok)return json({error:'Catálogo indisponível',letter},502);
   const rows=(await r.text()).split(/\r?\n/).map(parseLine).filter(Boolean);
   return json({letter,count:rows.length,items:rows},200,900);
  }
  if(!key&&!token)return json({error:'Configure TMDB_API_KEY ou TMDB_READ_TOKEN nas variáveis do Cloudflare Pages'},503);
  let endpoint;
  if(u.searchParams.has('id')){
   const id=u.searchParams.get('id');if(!/^\d+$/.test(id))return json({error:'ID inválido'},400);
   endpoint=`/movie/${id}?language=pt-BR&append_to_response=credits,release_dates`;
  }else if(u.searchParams.has('search')){
   const q=(u.searchParams.get('search')||'').slice(0,100);
   endpoint=`/search/movie?language=pt-BR&query=${encodeURIComponent(q)}`;
  }else return json({error:'Use letter, id ou search'},400);
  const tmdbUrl=`${TMDB}${endpoint}${key?`${endpoint.includes('?')?'&':'?'}api_key=${encodeURIComponent(key)}`:''}`;
  const response=await fetch(tmdbUrl,{headers:token?{Authorization:`Bearer ${token}`}:{},cf:{cacheTtl:86400,cacheEverything:true}});
  if(!response.ok)return json({error:'TMDB indisponível',status:response.status},response.status);
  return json(await response.json(),200,86400);
 }catch(e){return json({error:'Falha ao consultar catálogo ou TMDB'},502);}
}
