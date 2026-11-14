const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s*\((?:19|20)\d{2}\)\s*$/,'').replace(/[^a-z0-9]+/g,' ').trim();
const read=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(fallback))}catch{return fallback}};
const canonical=i=>`${i.type==='movie'?'movie':'tv'}:${i.tmdbId||norm(i.title)}`;
let channels=[],index=[],tab='all',active=[],detailCache=new Map();
function channelCard(c){return `<div class="favorite-tile channel"><a href="/live.html#${encodeURIComponent(c.id)}"><div class="poster">${c.logo?`<img loading="lazy" src="${esc(c.logo)}" alt="">`:'TV'}</div><strong>${esc(c.name)}</strong><small>${esc(c.category||'Ao vivo')}</small></a><button class="remove-fav" data-remove-channel="${esc(c.id)}">♥ Remover</button></div>`}
function vodCard(i){const type=i.type==='tv'?'series':i.type;const letter=/^[A-Z]$/.test(i.letter)?i.letter:(i.title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').charAt(0).toUpperCase();const url=`/movies.html?category=${encodeURIComponent(type)}&letter=${encodeURIComponent(letter||'#')}&title=${encodeURIComponent(i.title)}`;return `<div class="favorite-tile nacaum-favorite-card" data-fav-key="${esc(i._key)}" tabindex="0"><a href="${url}"><div class="poster">${i.poster_path?`<img loading="lazy" src="https://image.tmdb.org/t/p/w342${esc(i.poster_path)}" alt="">`:esc(i.title)}</div><strong>${esc(i.title)}</strong><small>${esc(({movie:'Filme',series:'Série',anime:'Anime',dorama:'Dorama'})[type]||'Série')}</small></a><div class="fav-hover"><strong>${esc(i.title)}</strong><p>${esc(i.overview||'Passe o mouse para ver detalhes do TMDB.')}</p><a href="${url}">Ver detalhes e episódios ›</a></div><button class="remove-fav" data-remove-vod="${esc(i._key)}">♥ Remover dos favoritos</button></div>`}
function migrate(){const raw=read('nacaum-vod-favorites',[]),details=read('nacaum-vod-favorite-details',{});const out={},keys=new Set();const byId=new Map(index.filter(i=>i.tmdbId).map(i=>[`${i.type==='movie'?'movie':'tv'}:${i.tmdbId}`,i]));const byName=new Map(index.map(i=>[`${i.type==='movie'?'movie':'tv'}:${norm(i.title)}`,i]));for(const old of raw){const d=details[old]||{};let match=byId.get(old)||byName.get(old)||byName.get(`${old.split(':')[0]==='movie'?'movie':'tv'}:${norm(d.title||old.split(':').slice(1).join(':'))}`);const item={...match,...d,title:d.title||match?.title||'',type:d.type||match?.type||'series'};if(!item.title)continue;const key=canonical(item);keys.add(key);out[key]={...match,...item,_key:key};}localStorage.setItem('nacaum-vod-favorites',JSON.stringify([...keys]));localStorage.setItem('nacaum-vod-favorite-details',JSON.stringify(out));return out}
function render(){const cf=new Set(read('nacaum-favs',[])),cs=channels.filter(c=>cf.has(c.id));const store=migrate();const unique=new Map();for(const [key,i] of Object.entries(store)){const identity=i.tmdbId?`${i.type==='movie'?'movie':'tv'}:id:${i.tmdbId}`:`${i.type==='movie'?'movie':'tv'}:title:${norm(i.title)}`;if(!unique.has(identity))unique.set(identity,{...i,_key:key})}active=[...unique.values()];$('#favCount').textContent=`${cs.length} canais · ${active.length} títulos favoritos`;$('#favoriteChannels').innerHTML=cs.length?cs.map(channelCard).join(''):'<p class="favorite-empty">Nenhum canal favoritado.</p>';$('#favoriteVod').innerHTML=active.length?active.map(vodCard).join(''):'<p class="favorite-empty">Nenhum título favoritado.</p>';$('#channelFavSection').hidden=tab==='vod';$('#vodFavSection').hidden=tab==='channels';}
document.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b){tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));render()}const ch=e.target.closest('[data-remove-channel]');if(ch){const s=new Set(read('nacaum-favs',[]));s.delete(ch.dataset.removeChannel);localStorage.setItem('nacaum-favs',JSON.stringify([...s]));render()}const vod=e.target.closest('[data-remove-vod]');if(vod){const k=vod.dataset.removeVod,s=new Set(read('nacaum-vod-favorites',[])),d=read('nacaum-vod-favorite-details',{});s.delete(k);delete d[k];localStorage.setItem('nacaum-vod-favorites',JSON.stringify([...s]));localStorage.setItem('nacaum-vod-favorite-details',JSON.stringify(d));render()}});
// Prévia cinematográfica: os favoritos nunca abrem um popup dentro do card.
let previewSeq=0;
async function previewFavorite(item){
 if(!item?.title)return;
 const seq=++previewSeq,hero=$('#favoritePreviewHero');
 const type=item.type==='movie'?'movie':'tv';
 const id=item.tmdbId||index.find(x=>norm(x.title)===norm(item.title)&&(type==='movie'?x.type==='movie':x.type!=='movie'))?.tmdbId;
 const cacheKey=type+':'+(id||norm(item.title));
 let d=detailCache.get(cacheKey);
 try{
  if(!d){const query=id?{id,type}:{search:item.title,type};const r=await fetch('/api/ondemand?'+new URLSearchParams(query));if(!r.ok)return;const data=await r.json();d=id?data:data.results?.[0];if(!d)return;detailCache.set(cacheKey,d)}
  if(seq!==previewSeq)return;
  const bg=d.backdrop_path?'https://image.tmdb.org/t/p/w1280'+d.backdrop_path:item.backdrop_path?'https://image.tmdb.org/t/p/w1280'+item.backdrop_path:'';
  if(bg)window.nacaumSetVodBackdrop?.(bg);
  $('#favoriteHeroTitle').textContent=d.title||d.name||item.title;
  const year=String(d.release_date||d.first_air_date||item.year||'').slice(0,4);
  const tags=[type==='movie'?'Filme':item.category==='anime'?'Anime':item.category==='dorama'?'Dorama':'Série',year,d.vote_average?'★ '+Number(d.vote_average).toFixed(1):'',...(d.genres||[]).slice(0,4).map(g=>g.name)].filter(Boolean);
  $('#favoriteHeroTags').replaceChildren(...tags.map(t=>{const span=document.createElement('span');span.textContent=t;return span}));
  $('#favoriteHeroSummary').textContent=d.overview||item.overview||'Sinopse indisponível.';
  hero.hidden=false;
 }catch(err){console.debug('Prévia favoritos:',err)}
}
function previewFromCard(el){const item=active.find(x=>x._key===el.dataset.favKey);if(item)previewFavorite(item)}
document.addEventListener('pointerover',e=>{const card=e.target.closest('.nacaum-favorite-card');if(card&&!card.contains(e.relatedTarget))previewFromCard(card)});
document.addEventListener('focusin',e=>{const card=e.target.closest('.nacaum-favorite-card');if(card)previewFromCard(card)});
window.addEventListener('storage',render);
(async()=>{try{[channels,index]=await Promise.all([fetch('/channels.json').then(r=>r.json()),fetch('/catalog-index.json').then(r=>r.json())]);render();if(active.length)previewFavorite(active[0])}catch(e){$('#favCount').textContent='Não foi possível carregar os favoritos.';console.error(e)}})();
function clock(){const el=$('#clock');if(el)el.textContent=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}clock();setInterval(clock,30000);
