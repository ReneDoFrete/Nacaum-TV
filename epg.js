// Grade Ao Vivo: Guia de TV -> Meu Guia -> XMLTV. Dados de programação, não streams.
const XMLTV_SOURCES=[
 'https://raw.githubusercontent.com/marcoshimselfxd/EPG-Scrapper-BR/main/epg.xml',
 'https://www.open-epg.com/files/brazil3.xml',
 'https://iptv-epg.org/files/epg-br.xml'
];
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
function parseGuia(html){
 const rows=[];
 for(const part of html.split(/<li\b/i).slice(1)){
  const dt=/<time\b[^>]*datetime=["']([^"']+)/i.exec(part)?.[1];
  const anchor=/<a\b[^>]*href=["'][^"']*\/programa\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(part)?.[1];
  if(!dt||!anchor)continue;
  const start=Date.parse(dt),title=decode(anchor);
  if(!Number.isFinite(start)||!title)continue;
  const afterTime=part.split(/<\/time>/i)[1]||'';
  const durationText=/<span\b[^>]*>([^<]+)<\/span>/i.exec(afterTime)?.[1]||'';
  const hm=/(\d+)\s*h\s*(\d+)?/.exec(durationText),mm=/(\d+)\s*min/.exec(durationText);
  const minutes=hm?(+hm[1]*60)+ +(hm[2]||0):mm?+mm[1]:60;
  const description=decode(/<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(part)?.[1]||'');
  rows.push({title,start,end:start+Math.max(1,minutes)*60000,description});
 }
 rows.sort((a,b)=>a.start-b.start);
 const unique=rows.filter((p,i)=>i===0||p.start!==rows[i-1].start);
 unique.forEach((p,i)=>{if(unique[i+1]&&p.end>unique[i+1].start)p.end=unique[i+1].start});
 return unique.filter(p=>p.end>Date.now()-3600000&&p.start<Date.now()+36*3600000);
}
function spDate(y,m,d,h,min){return Date.UTC(y,m-1,d,h+3,min)}
function parseMeu(html){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).split('-').map(Number);let [y,m,d]=today;const list=[];
 for(const part of html.split(/<li\b/i).slice(1)){if(part.includes('subheader')){const match=/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/.exec(part.slice(0,450));if(match){d=+match[1];m=+match[2];y=today[0]+(m<today[1]?1:0)}continue}
 const tm=/lileft time['"][^>]*>\s*(\d{1,2}):(\d{2})/i.exec(part);const title=/<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(part)?.[1];if(!tm||!title)continue;list.push({title:decode(title),start:spDate(y,m,d,+tm[1],+tm[2]),description:'',end:0})}
 list.sort((a,b)=>a.start-b.start);list.forEach((p,i)=>p.end=list[i+1]?.start||p.start+3600000);return list.filter(p=>p.end>Date.now()-3600000&&p.start<Date.now()+36*3600000)}
async function getText(url,timeout=7500){const c=new AbortController();const timer=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; NacaumTV-EPG/1.0)'}});if(!r.ok)throw Error('HTTP '+r.status);return await r.text()}finally{clearTimeout(timer)}}
async function limited(items,limit,fn){let cursor=0;const results=[];await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const i=cursor++;try{results[i]=await fn(items[i])}catch{results[i]=null}}}));return results}
function parseXml(xml){const now=Date.now(),map=new Map();const channelNames=new Map();
 for(const m of xml.matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi)){
  const id=/\bid=["']([^"']+)["']/i.exec(m[1])?.[1];if(!id)continue;
  const names=[...m[2].matchAll(/<display-name(?:\s[^>]*)?>([\s\S]*?)<\/display-name>/gi)].map(x=>norm(decode(x[1]))).filter(Boolean);
  channelNames.set(id,names);
 } const re=/<programme\s+([^>]+)>([\s\S]*?)<\/programme>/g;let m;while((m=re.exec(xml))){const a=/\bstart="([^"]+)"/.exec(m[1])?.[1],b=/\bstop="([^"]+)"/.exec(m[1])?.[1],ch=/\bchannel="([^"]+)"/.exec(m[1])?.[1];if(!a||!b||!ch)continue;const start=date(a),end=date(b);if(!Number.isFinite(start)||!Number.isFinite(end)||end<now-3600000||start>now+36*3600000)continue;const title=decode(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/.exec(m[2])?.[1]);if(!title)continue;const description=decode(/<desc(?:\s[^>]*)?>([\s\S]*?)<\/desc>/.exec(m[2])?.[1]);const keys=[norm(ch),norm(ch.replace(/\.[a-z]{2,3}$/i,'')),...(channelNames.get(ch)||[])].filter(Boolean);for(const k of new Set(keys)){if(!map.has(k))map.set(k,[]);map.get(k).push({title,start,end,description})}}return map}
// As tabelas oficiais do Saimo são a fonte de verdade para os IDs dos canais.
// A versão embutida mantém os canais principais mesmo se guia.txt estiver indisponível.
const MEU_CODES=`A&E:MDO|Animal Planet:APL|Band:BAN|Cartoon Network:CAR|Cinemax:MNX|Combate:135|Discovery Kids:DIK|Discovery World:DIW|ESPN:ESP|ESPN 2:ES2|ESPN 3:ES3|ESPN 4:ES4|ESPN 5:ES5|GNT:GNT|Globo RJ:GRD|Globo SP:GRD|Globo:GRD|GloboNews:GLN|Gloob:GOB|Gloobinho:GBI|HBO:HBO|HBO Family:HFA|HBO Plus:HPL|HBO2:HB2|History:HIS|Megapix:MPX|Record:REC|SBT:SBT|Space:SPA|SporTV:SPO|SporTV 2:SP2|SporTV 3:SP3|TNT:TNT|TNT Séries:TBS|Telecine Action:TC2|Telecine Pipoca:TC4|Telecine Premium:TC1|Universal TV:USA|Warner:WBT|AXN:AXN|Canal Brasil:CBR|Discovery Channel:DIS|Discovery Home & Health:HEA|Discovery Science:DSC|Discovery Turbo:DTU|E!:EET|Sony Channel:SET|Studio Universal:HAL|Band Sports:BSP|Premiere Clubes:121|Premiere:121|Multishow:MSH|Viva:VIV|Arte 1:BQ5|TLC:TRV|AMC:MGM|Band News:NEW|Record News:RCN|RedeTV:RTV|TCM:TCM|Telecine Cult:TC5|Telecine Fun:TC6|Telecine Touch:TC3|TV Aparecida:TAP|TV Cultura:CUL|TV Gazeta:GAZ|TV Brasil:TED`;
const GUIDE_SLUGS=`a e:ae|agro:agro|amc:amc|animal planet:animal-planet|arte 1:arte-1|axn:axn|band:band|band rj:band-rj|band news:bandnews|band sports:bandsports|bbc world:bbc-world|bis:bis|bloomberg:bloomberg|box kids:box-kids|canal educacao:canal-educacao|canal rural:canal-rural|canal uol:canal-uol|cancao nova:cancao-nova|cartoon network:cartoon-network|cartoonito:cartoonito|cinemax:cinemax|cnn brasil:cnn-brasil|combate:combate|curta:curta|discovery channel:discovery-channel|discovery home health:discovery-home-health|discovery kids:discovery-kids|discovery science:discovery-science|discovery theater:discovery-theater|discovery turbo:discovery-turbo|discovery world:discovery-world|discovery id:investigacao-discovery|e:e|espn:espn|espn 2:espn-2|espn 3:espn-3|espn 4:espn-4|espn 5:espn-5|espn 6:espn-6|film arts:film-arts|food network:food-network|fox news:fox-news|futura:futura|ge tv:ge-tv|globo news:globo-news|globonews:globo-news|globo rj:globo-rio-de-janeiro|globo:globo-sp|globo sp:globo-sp|gloob:gloob|gloobinho:gloobinho|gnt:gnt|hbo:hbo|hbo 2:hbo-2|hbo family:hbo-family|hbo mundi:hbo-mundi|hbo plus:hbo-plus|hbo pop:hbo-pop|hbo signature:hbo-signature|hbo xtreme:hbo-xtreme|hgtv:hgtv|history:history|history 2:history-2|jovem pan news:jovem-pan-news|lifetime:lifetime|megapix:megapix|multishow:multishow|music box brazil:music-box-brazil|nsports:nsports|off:off|premiere:premiere-fc|premiere 2:premiere-2|premiere 3:premiere-3|premiere 4:premiere-4|premiere 5:premiere-5|premiere 6:premiere-6|premiere 7:premiere-7|record news:record-news|record:record-tv|rede brasil:rede-brasil|rede familia:rede-familia|redetv:rede-tv|rede vida:rede-vida|sbt:sbt|sbt rj:sbt-rio-de-janeiro|sony:sony|space:space|sportv:sportv|sportv 2:sportv-2|sportv 3:sportv-3|studio universal:studio-universal|syfy:syfy|tcm:tcm|telecine action:telecine-action|telecine cult:telecine-cult|telecine fun:telecine-fun|telecine pipoca:telecine-pipoca|telecine premium:telecine-premium|telecine touch:telecine-touch|tlc:tlc|tnt:tnt|tnt novelas:tnt-novelas|tnt series:tnt-series|tooncast:tooncast|trutv:trutv|adult swim:trutv|tv aparecida:tv-aparecida|tv brasil:tv-brasil|tv camara:tv-camara|tv cultura:tv-cultura|tv gazeta:tv-gazeta|tv senado:tv-senado|universal tv:universal-tv|viva:viva|warner:warner|woohoo:woohoo|xsports:xsports`;
function pairs(text){return Object.fromEntries(text.split('|').map(x=>x.split(':')).filter(x=>x.length===2).map(([a,b])=>[norm(a),b]));}
const BASE_CODES=pairs(MEU_CODES),BASE_SLUGS=pairs(GUIDE_SLUGS);
let tableCache=null,tableAt=0,centralCache=null,centralAt=0;
async function tables(){
 if(tableCache&&Date.now()-tableAt<6*3600000)return tableCache;
 const t={meuguia:{...BASE_CODES},guiadetv:{...BASE_SLUGS},alias:{},feeds:[...XMLTV_SOURCES],pluto:''};
 try{const raw=await getText('https://canais-saimo.pages.dev/guia.txt',8000);if(!raw.includes('guiadetv\t'))throw Error('guia.txt inválido');
 for(const line of raw.split(/\r?\n/)){if(!line||line.startsWith('#'))continue;const [type,key,value]=line.split('\t').map(x=>x?.trim());if(!value)continue;
 if(type==='meuguia'||type==='guiadetv'||type==='alias')t[type][norm(key)]=type==='alias'?norm(value):value;
 if(type==='feed'&&/^https:\/\//.test(value)&&!t.feeds.includes(value))t.feeds.push(value);
 if(type==='pluto')t.pluto=value;
 }}catch(e){console.warn('[EPG] guia.txt: usando mapeamento embutido',String(e));}
 tableCache=t;tableAt=Date.now();return t;
}
async function central(){if(centralCache&&Date.now()-centralAt<30*60000)return centralCache;try{const d=JSON.parse(await getText('https://canais-saimo.pages.dev/epg.json',11000));if(!d?.g||!d?.m)throw Error('central inválida');centralCache=d;centralAt=Date.now();return d;}catch(e){console.warn('[EPG] epg.json indisponível',String(e));return centralCache;}}
function centralRows(items){return (items||[]).map(([start,end,title,description])=>({title,start:Number(start)*1000,end:Number(end)*1000,description:description||''})).filter(p=>p.title&&p.end>Date.now()-3600000&&p.start<Date.now()+36*3600000)}
function cleanName(name){return String(name||'').replace(/\s*\((?:s\d+|ot|rk|b\d+|alt)\)\s*$/i,'').replace(/\b(?:hd|fhd|sd|uhd|4k)\b/gi,'').trim()}
function candidates(name){const n=norm(cleanName(name));const a=[n];const v=n.replace(/(?:sp|rj|mg|go|am|ce|df|es|pb|pe|rs|ba|pr|rn|pa|pi|se)$/,'');if(v&&v!==n)a.push(v);return a;}
async function build(channels){
 const t=await tables(), pre=await central(),byId={};const groups=new Map(),meuGroups=new Map();
 for(const c of channels){const keys=candidates(c.name);const slug=keys.map(k=>t.guiadetv[k]).find(Boolean);const code=keys.map(k=>t.meuguia[k]).find(Boolean);
 if(slug){if(!groups.has(slug))groups.set(slug,[]);groups.get(slug).push(c)}
 if(code){if(!meuGroups.has(code))meuGroups.set(code,[]);meuGroups.get(code).push(c)}
 }
 await limited([...groups],6,async([s,cs])=>{let schedule=centralRows(pre?.g?.[s]);if(!schedule.length){try{schedule=parseGuia(await getText(/^https?:/.test(s)?s:`https://www.guiadetv.com/canal/${s}`,8500))}catch{}}
 if(schedule.length)for(const c of cs)byId[c.id]={schedule,source:'guiadetv'};
 });
 await limited([...meuGroups],4,async([code,cs])=>{const missing=cs.filter(c=>!byId[c.id]);if(!missing.length)return;let schedule=centralRows(pre?.m?.[code]);if(!schedule.length){try{schedule=parseMeu(await getText(`https://meuguia.tv/programacao/canal/${code}`,8000))}catch{}}
 if(schedule.length)for(const c of missing)byId[c.id]={schedule,source:'meuguia'};
 });
 const missing=channels.filter(c=>!byId[c.id]);
 if(missing.length){for(const url of t.feeds){if(!missing.some(c=>!byId[c.id]))break;try{const map=parseXml(await getText(url,20000));for(const c of missing){if(byId[c.id])continue;const keys=candidates(c.name);const alias=keys.map(k=>t.alias[k]).find(Boolean);const match=[alias,...keys].filter(Boolean).find(k=>map.has(k));if(match){const schedule=map.get(match).sort((a,b)=>a.start-b.start);if(schedule.length)byId[c.id]={schedule,source:url.includes('EPG-Scrapper-BR')?'epg-scrapper-br':'xmltv'};}}}catch(e){console.warn('[EPG] feed',url,String(e))}}}
 const now=Date.now();for(const entry of Object.values(byId)){entry.schedule=entry.schedule.filter(p=>p.end>now-3600000).slice(0,60);const current=entry.schedule.find(p=>p.start<=now&&p.end>now);entry.title=current?.title||'';entry.description=current?.description||'';entry.start=current?.start||0;entry.end=current?.end||0}
 console.log('[EPG] canais cobertos',Object.keys(byId).length,'de',channels.length);return byId;
}
export async function getGuide(channels){const now=Date.now();if(cache.at&&now-cache.at<CACHE_MS)return cache.guide;if(!cache.loading){cache.loading=build(channels).then(guide=>{if(Object.keys(guide).length)cache={at:Date.now(),guide,loading:null};return guide}).catch(e=>{console.error('[EPG]',e);return cache.guide}).finally(()=>{cache.loading=null})}return cache.loading}
