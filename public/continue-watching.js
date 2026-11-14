(()=>{
'use strict';
const KEY='nacaum-continue';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=()=>{try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a:[]}catch{return []}};
const kind=x=>['anime','dorama'].includes(x.category)?x.category:(x.type==='movie'?'movie':'series');
function write(items){localStorage.setItem(KEY,JSON.stringify(items.slice(0,60)));window.dispatchEvent(new Event('nacaum-continue-updated'))}
function same(a,b){return norm(a.title)===norm(b.title)&&kind(a)===kind(b)}
function save(entry){if(!entry?.title)return;const old=read(),previous=old.find(x=>same(x,entry));const result={...previous,...entry,position:Number(entry.position)||0,updatedAt:Date.now()};write([result,...old.filter(x=>!same(x,entry))])}
function start(entry){if(!entry?.title)return;const old=read(),previous=old.find(x=>same(x,entry));save({...previous,...entry,position:previous?.position||0,duration:previous?.duration||0})}
function remove(title,type){write(read().filter(x=>!(norm(x.title)===norm(title)&&x.type===type)))}
window.NacaumContinue={read,save,start,remove,kind};
function currentCategory(){if(document.querySelector('#homeHero'))return 'home';return window.nacaumCurrentVodCategory||new URLSearchParams(location.search).get('category')||'home'}
function filtered(){const cat=currentCategory();return read().filter(x=>x.title&&(cat==='home'||kind(x)===cat))}
function render(){const target=document.querySelector('#nacaumContinueSection');if(!target)return;const items=filtered();target.hidden=!items.length;if(!items.length){target.innerHTML='';return}
 target.innerHTML='<h2>Continue assistindo</h2><div class="nacaum-continue-rail">'+items.map((x,i)=>{const poster=x.poster_path?.startsWith('/')?'https://image.tmdb.org/t/p/w342'+x.poster_path:'';const pct=x.duration>0?Math.min(100,Math.round(x.position/x.duration*100)):0;return `<button type="button" class="nacaum-continue-card" data-continue-index="${i}"><span class="nacaum-continue-poster">${poster?`<img loading="lazy" src="${poster}" alt="">`:'▶'}<span class="nacaum-continue-progress" style="width:${pct}%"></span></span><strong>${esc(x.title)}</strong><small>${esc(x.episodeLabel||'Continuar reprodução')}</small></button>`}).join('')+'</div>';
 target.onclick=e=>{const card=e.target.closest('[data-continue-index]');if(!card)return;const item=filtered()[Number(card.dataset.continueIndex)];if(!item)return;if(window.nacaumResume)window.nacaumResume(item).catch(console.error);else location.href='/movies.html?category='+encodeURIComponent(kind(item))+'&title='+encodeURIComponent(item.title)+'&resume=1'};
 target.onpointerover=e=>{const card=e.target.closest('[data-continue-index]');if(!card||card.contains(e.relatedTarget))return;const item=filtered()[Number(card.dataset.continueIndex)];if(item)window.nacaumPreviewTitle?.(item)};
 target.onfocusin=e=>{const card=e.target.closest('[data-continue-index]');if(card){const item=filtered()[Number(card.dataset.continueIndex)];if(item)window.nacaumPreviewTitle?.(item)}};
}
function mount(){if(!document.querySelector('#movieVideo'))return;let target=document.querySelector('#nacaumContinueSection');if(!target){target=document.createElement('section');target.id='nacaumContinueSection';target.className='nacaum-continue-section';const anchor=document.querySelector('#discoverHome')||document.querySelector('#catalogSection');if(anchor)anchor.before(target)}render()}
document.addEventListener('DOMContentLoaded',mount);window.addEventListener('nacaum-continue-updated',render);window.addEventListener('popstate',render);
window.nacaumRenderContinue=render;
})();
