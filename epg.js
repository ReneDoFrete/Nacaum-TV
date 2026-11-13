// XMLTV: metadados de programação, sem acessar transmissões de vídeo.
const SOURCES=['https://www.open-epg.com/files/brazil3.xml','https://iptv-epg.org/files/epg-br.xml'];
let cache={at:0,programs:[],loading:null};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(hd|sd|fhd|br|tv|channel)\b/g,'').replace(/[^a-z0-9]/g,'');
const date=s=>{const m=String(s).match(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)\s*([+-])(\d\d)(\d\d)/);if(!m)return NaN;return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])-(m[7]==='+'?1:-1)*(+m[8]*60+(+m[9]))*60000};
const decode=s=>String(s||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
function parse(xml){
 const now=Date.now(),list=[];const re=/<programme\s+([^>]+)>([\s\S]*?)<\/programme>/g;let m;
 while((m=re.exec(xml))){
  const attrs=m[1],body=m[2];const start=/\bstart="([^"]+)"/.exec(attrs)?.[1],stop=/\bstop="([^"]+)"/.exec(attrs)?.[1],channel=/\bchannel="([^"]+)"/.exec(attrs)?.[1];
  if(!start||!stop||!channel)continue;const a=date(start),b=date(stop);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<now-3600000||a>now+12*3600000)continue;
  const title=/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/.exec(body)?.[1]||'';
  const description=/<desc(?:\s[^>]*)?>([\s\S]*?)<\/desc>/.exec(body)?.[1]||'';
  list.push({channel,title:decode(title),description:decode(description),start:a,end:b});
 }return list;
}
async function refresh(){
 if(cache.loading)return cache.loading;
 cache.loading=(async()=>{
  const all=await Promise.allSettled(SOURCES.map(async url=>{
   const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),18000);
   try{const r=await fetch(url,{signal:ctrl.signal});if(!r.ok)throw Error('EPG HTTP '+r.status);return parse(await r.text())}finally{clearTimeout(timeout)}
  }));
  const programs=all.filter(x=>x.status==='fulfilled').flatMap(x=>x.value);
  if(programs.length)cache={at:Date.now(),programs,loading:null};
  return programs;
 })().finally(()=>{cache.loading=null});return cache.loading;
}
export async function getGuide(channels){
 if(Date.now()-cache.at>45*60*1000)await refresh().catch(()=>{});
 const now=Date.now(),byChannel=new Map();
 for(const p of cache.programs){const key=normalize(p.channel);if(!byChannel.has(key))byChannel.set(key,[]);byChannel.get(key).push(p)}
 const result={};
 for(const c of channels){
  const name=normalize(c.name);
  const key=byChannel.has(name)?name:[...byChannel.keys()].find(k=>name.length>4&&k.startsWith(name));
  if(!key)continue;
  const schedule=byChannel.get(key).sort((a,b)=>a.start-b.start).filter(p=>p.end>now-3600000).slice(0,32).map(({title,start,end,description})=>({title,start,end,description}));
  const current=schedule.find(p=>p.start<=now&&p.end>now);
  if(current)result[c.id]={...current,schedule};
  else if(schedule.length)result[c.id]={title:'',schedule};
 }
 return result;
}
