// Grade Ao Vivo: Guia de TV -> Meu Guia -> XMLTV. Dados de programação, não streams.
const XMLTV_SOURCES=['https://www.open-epg.com/files/brazil3.xml','https://iptv-epg.org/files/epg-br.xml'];
const CACHE_MS=30*60*1000;
let cache={at:0,guide:{},loading:null};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(hd|sd|fhd|uhd|4k|br|tv|channel)\b/g,'').replace(/[^a-z0-9]/g,'');
const decode=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|nbsp|#39);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&nbsp;':' ','&#39;':"'"}[x]||x)).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).trim();
const date=s=>{const m=String(s).match(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?\s*([+-])(\d\d)(\d\d)/);if(!m)return NaN;return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0))-(m[7]==='+'?1:-1)*(+m[8]*60+(+m[9]))*60000};
const aliases={
 'globo':'globo','globorj':'globo-rj','globosp':'globo-sp','globoam':'globo-am','globobahia':'globo-ba','globoce':'globo-ce','globodf':'globo-df','globoes':'globo-es','globogo':'globo-go','globomg':'globo-mg','globopb':'globo-pb','globope':'globo-pe','globors':'globo-rs',
 'record':'record','recordrj':'record-rj','recordsp':'record-sp','sbt':'sbt','sbtrj':'sbt-rj','sbtsp':'sbt-sp','band':'band','bandrj':'band-rj','bandsp':'band-sp',
 'redetv':'rede-tv','tvcultura':'tv-cultura','tvbrasil':'tv-brasil','globonews':'globonews','cnnbrasil':'cnn-brasil','recordnews':'record-news','bandnews':'band-news',
 'sportv':'sportv','sportv2':'sportv-2','sportv3':'sportv-3','premiereclubes':'premiere','premiere':'premiere','premiere2':'premiere-2','premiere3':'premiere-3','premiere4':'premiere-4','premiere5':'premiere-5','premiere6':'premiere-6','premiere7':'premiere-7','premiere8':'premiere-8',
 'espn':'espn','espn2':'espn-2','espn3':'espn-3','espn4':'espn-4','espn5':'espn-5','espn6':'espn-6','bandsports':'band-sports','combate':'combate','telecinepremium':'telecine-premium','telecineaction':'telecine-action','telecinepipoca':'telecine-pipoca','telecinefun':'telecine-fun','telecinetouch':'telecine-touch','telecinecult':'telecine-cult'
};
const skip=/\b(jogo|evento|alternativo|backup|opcao|fonte)\b|(?:\+|\b0\d\b)/i;
function slug(c){const name=String(c.name||'').replace(/\s*\((?:s\d+|ot|rk|b\d+|alt)\)\s*$/i,'').trim();const k=norm(name);if(aliases[k])return aliases[k];if(skip.test(name)||/\d{2}$/.test(name))return null;return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||null}
function parseGuia(html){const rows=[];for(const part of html.split(/<li\b/i).slice(1)){
 const dt=/<time\b[^>]*datetime=["']([^"']+)/i.exec(part)?.[1];const link=/<a\b[^>]*href=["'][^"']*\/programa\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(part)?.[1];if(!dt||!link)continue;
 const start=Date.parse(dt),title=decode(link);if(!Number.isFinite(start)||!title)continue;
 const dur=/<\/time>[\s\S]{0,250}?<span[^>]*>([^<]+)<\/span>/i.exec(part)?.[1]||'';let minutes=60;const hm=/(\d+)\s*h\s*(\d+)?/.exec(dur);const mm=/(\d+)\s*min/.exec(dur);if(hm)minutes=(+hm[1]*60)+ +(hm[2]||0);else if(mm)minutes=+mm[1];
 const description=decode(/<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(part)?.[1]||'');rows.push({title,start,end:start+Math.max(1,minutes)*60000,description});
 }rows.sort((a,b)=>a.start-b.start);const unique=rows.filter((p,i)=>i===0||p.start!==rows[i-1].start);unique.forEach((p,i)=>{if(unique[i+1]&&p.end>unique[i+1].start)p.end=unique[i+1].start});return unique.filter(p=>p.end>Date.now()-3600000&&p.start<Date.now()+36*3600000)}
function spDate(y,m,d,h,min){return Date.UTC(y,m-1,d,h+3,min)}
function parseMeu(html){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).split('-').map(Number);let [y,m,d]=today;const list=[];
 for(const part of html.split(/<li\b/i).slice(1)){if(part.includes('subheader')){const match=/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/.exec(part.slice(0,450));if(match){d=+match[1];m=+match[2];y=today[0]+(m<today[1]?1:0)}continue}
 const tm=/lileft time['"][^>]*>\s*(\d{1,2}):(\d{2})/i.exec(part);const title=/<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(part)?.[1];if(!tm||!title)continue;list.push({title:decode(title),start:spDate(y,m,d,+tm[1],+tm[2]),description:'',end:0})}
 list.sort((a,b)=>a.start-b.start);list.forEach((p,i)=>p.end=list[i+1]?.start||p.start+3600000);return list.filter(p=>p.end>Date.now()-3600000&&p.start<Date.now()+36*3600000)}
async function getText(url,timeout=7500){const c=new AbortController();const timer=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; NacaumTV-EPG/1.0)'}});if(!r.ok)throw Error('HTTP '+r.status);return await r.text()}finally{clearTimeout(timer)}}
async function limited(items,limit,fn){let cursor=0;const results=[];await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const i=cursor++;try{results[i]=await fn(items[i])}catch{results[i]=null}}}));return results}
function parseXml(xml){const now=Date.now(),map=new Map();const re=/<programme\s+([^>]+)>([\s\S]*?)<\/programme>/g;let m;while((m=re.exec(xml))){const a=/\bstart="([^"]+)"/.exec(m[1])?.[1],b=/\bstop="([^"]+)"/.exec(m[1])?.[1],ch=/\bchannel="([^"]+)"/.exec(m[1])?.[1];if(!a||!b||!ch)continue;const start=date(a),end=date(b);if(!Number.isFinite(start)||!Number.isFinite(end)||end<now-3600000||start>now+36*3600000)continue;const title=decode(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/.exec(m[2])?.[1]);if(!title)continue;const description=decode(/<desc(?:\s[^>]*)?>([\s\S]*?)<\/desc>/.exec(m[2])?.[1]);const k=norm(ch.replace(/\.[a-z]{2,3}$/i,''));if(!map.has(k))map.set(k,[]);map.get(k).push({title,start,end,description})}return map}
async function build(channels){const byId={};const groups=new Map();for(const c of channels){const s=slug(c);if(!s)continue;if(!groups.has(s))groups.set(s,[]);groups.get(s).push(c)}
 // Limita a busca inicial a canais reais, sem fontes de evento numeradas.
 const slugs=[...groups.keys()].slice(0,75);
 await limited(slugs,16,async s=>{const html=await getText(`https://www.guiadetv.com/canal/${encodeURIComponent(s)}`,4500);const schedule=parseGuia(html);if(schedule.length)for(const c of groups.get(s))byId[c.id]={schedule,source:'guiadetv'}});
 // Reserva: páginas Meu Guia. A correspondência é por slug, sem inventar programas.
 const missing=slugs.filter(s=>groups.get(s).some(c=>!byId[c.id]));
 await limited(missing.slice(0,45),14,async s=>{const html=await getText(`https://meuguia.tv/programacao/canal/${encodeURIComponent(s)}`,4000);const schedule=parseMeu(html);if(schedule.length)for(const c of groups.get(s))if(!byId[c.id])byId[c.id]={schedule,source:'meuguia'}});
 // XMLTV completa o que não foi encontrado nas páginas.
 const missingChannels=channels.filter(c=>!byId[c.id]);if(missingChannels.length){const feeds=await Promise.allSettled(XMLTV_SOURCES.map(u=>getText(u,13000).then(parseXml)));for(const result of feeds){if(result.status!=='fulfilled')continue;const map=result.value;for(const c of missingChannels){if(byId[c.id])continue;const name=norm(c.name);const key=map.has(name)?name:[...map.keys()].find(k=>name.length>4&&(k===name||k.startsWith(name)));if(key){const schedule=map.get(key).sort((a,b)=>a.start-b.start);if(schedule.length)byId[c.id]={schedule,source:'xmltv'}}}}}
 const now=Date.now();for(const entry of Object.values(byId)){entry.schedule=entry.schedule.filter(p=>p.end>now-3600000).slice(0,40);const current=entry.schedule.find(p=>p.start<=now&&p.end>now);entry.title=current?.title||'';entry.description=current?.description||'';entry.start=current?.start||0;entry.end=current?.end||0}return byId}
export async function getGuide(channels){const now=Date.now();if(cache.at&&now-cache.at<CACHE_MS)return cache.guide;if(!cache.loading){cache.loading=build(channels).then(guide=>{if(Object.keys(guide).length)cache={at:Date.now(),guide,loading:null};return guide}).catch(e=>{console.error('[EPG]',e);return cache.guide}).finally(()=>{cache.loading=null})}return cache.loading}
