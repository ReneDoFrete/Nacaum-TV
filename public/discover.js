const DROOT='/';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const safe=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const img=p=>p&&p.startsWith('/')?'https://image.tmdb.org/t/p/w342'+p:'';
let catalogPromise, highlightsPromise;
const catalog=()=>catalogPromise??=fetch('/catalog-index.json').then(r=>r.json());
const highlights=()=>highlightsPromise??=fetch('/highlights.json').then(r=>r.json());
function destination(item){let type=item.type==='movie'?'movie':item.type==='tv'?'series':item.type;let letter=/^[A-Z]$/.test(item.letter)?item.letter:'#';return `/movies.html?category=${encodeURIComponent(type)}&letter=${letter}&title=${encodeURIComponent(item.title)}`}
function shelfCard(i){const title=safe(i.title),year=safe(i.year||'');return `<a class="discover-card nacaum-hover-card" href="${destination(i)}" data-movie-title="${title}" data-movie-type="${safe(i.type)}" title="${title}"><span class="discover-cover">${img(i.poster_path)?`<img loading="lazy" decoding="async" src="${img(i.poster_path)}" alt="">`:''}<span class="hover-play">▶</span></span><strong>${title}</strong><small>${year}</small></a>`} 
function shelf(name,items){const id='rail-'+Math.random().toString(36).slice(2);return `<section class="discover-section"><div class="discover-heading"><h2>${safe(name)}</h2></div><div class="vod-rail-shell"><button type="button" class="vod-arrow prev" data-scroll="${id}" data-dir="-1" aria-label="Voltar em ${safe(name)}">‹</button><div class="discover-rail" id="${id}">${items.slice(0,28).map(shelfCard).join('')}</div><button type="button" class="vod-arrow next" data-scroll="${id}" data-dir="1" aria-label="Avançar em ${safe(name)}">›</button></div></section>`}
function azSection(){return `<section class="discover-section vod-az"><h2>Explorar de A a Z</h2><div class="az-categories">${[['movie','Filmes'],['series','Séries'],['anime','Animes'],['dorama','Doramas']].map(([k,n])=>`<a href="/movies.html?category=${k}&letter=A">${n} de A a Z <span>›</span></a>`).join('')}</div></section>`}
function updateVodArrows(home){home.querySelectorAll('.vod-rail-shell').forEach(shell=>{const rail=shell.querySelector('.discover-rail');if(!rail)return;const max=Math.max(0,rail.scrollWidth-rail.clientWidth);const prev=shell.querySelector('.vod-arrow.prev'),next=shell.querySelector('.vod-arrow.next');if(prev)prev.disabled=rail.scrollLeft<=2;if(next)next.disabled=rail.scrollLeft>=max-2})}
function bindVodArrows(home){if(home.dataset.vodArrows)return;home.dataset.vodArrows='1';home.addEventListener('click',e=>{const btn=e.target.closest('.vod-arrow[data-scroll]');if(!btn||btn.disabled)return;const rail=document.getElementById(btn.dataset.scroll);if(rail)rail.scrollBy({left:Number(btn.dataset.dir)*Math.max(300,rail.clientWidth*.85),behavior:'smooth'})});home.addEventListener('scroll',e=>{if(e.target.classList?.contains('discover-rail'))updateVodArrows(home)},true);window.addEventListener('resize',()=>updateVodArrows(home));if('ResizeObserver' in window){const obs=new ResizeObserver(()=>updateVodArrows(home));obs.observe(home)}}
let discoverView='home', discoverGeneration=0;
async function renderDiscover(view='home'){
 const home=document.querySelector('#discoverHome');if(!home)return;
 discoverView=view;const generation=++discoverGeneration;
 home.innerHTML='<p class="vod-loading">Carregando seções…</p>';
 try{
  const rows=await highlights();if(generation!==discoverGeneration)return;
  if(view==='home'){
   home.innerHTML=rows.map(r=>shelf(r.name,r.items)).join('')+azSection();
   bindVodArrows(home);requestAnimationFrame(()=>updateVodArrows(home));
   return;
  }
  const all=await catalog();if(generation!==discoverGeneration)return;
  if(view==='anime'||view==='dorama'){
   const category=view;const remote=await fetch('/api/ondemand?category='+category).then(r=>{if(!r.ok)throw Error('Catálogo indisponível');return r.json()});
   if(generation!==discoverGeneration)return;
   const metadataByTitle=new Map(all.filter(i=>i.type==='series'||i.type==='tv').map(i=>[norm(i.title).replace(/[^a-z0-9]+/g,' ').trim(),i]));
   const selected=(remote.items||[]).map(i=>{
     const key=norm(i.title).replace(/[^a-z0-9]+/g,' ').trim();
     const meta=metadataByTitle.get(key)||metadataByTitle.get(key.replace(/\s+(?:19|20)\d{2}$/,''));
     return {...meta,...i,type:category,poster_path:meta?.poster_path||i.poster_path||'',genres:meta?.genres||i.genres||[],year:i.year||meta?.year||'',tmdbId:i.tmdbId||meta?.tmdbId||null};
   });
   const featured=rows.find(r=>norm(r.name)===norm(category==='anime'?'Animes':'Doramas'))?.items||[];
   const current=selected.filter(i=>Number(i.year||0)>=2025);
   const popular=selected.filter(i=>i.poster_path).slice(0,28);
   const sections=[
    [category==='anime'?'Animes em alta':'Doramas em alta',featured.length?featured.map(x=>({...x,type:category})):popular],
    [category==='anime'?'Novos animes de 2026':'Novos doramas de 2026',selected.filter(i=>Number(i.year)===2026).slice(0,28)],
    ['Populares e em alta',popular],
    ['Lançamentos recentes',current.slice(0,28)]
   ];
   const genreNames=category==='anime'?['Animação','Ação','Aventura','Fantasia','Comédia','Drama','Ficção científica','Mistério','Romance']:['Drama','Romance','Comédia','Ação','Mistério','Crime','Fantasia','Suspense'];
   for(const genre of genreNames){
     const matching=selected.filter(i=>(i.genres||[]).some(g=>norm(typeof g==='string'?g:g.name)===norm(genre)));
     if(matching.length)sections.push([genre,matching.slice(0,28)]);
   }
   home.innerHTML=sections.filter(([,items])=>items.length).map(([name,items])=>shelf(name,items)).join('')+
    `<section class="discover-section vod-last-catalog"><div class="discover-heading"><h2>Catálogo de ${category==='anime'?'animes':'doramas'} de A a Z</h2></div><div class="vod-letter-buttons">${['#',...Array.from({length:26},(_,i)=>String.fromCharCode(65+i))].map(l=>`<button type="button" data-open-letter="${l}">${l}</button>`).join('')}</div>${shelf('Explorar '+(category==='anime'?'animes':'doramas'),selected.slice(0,28))}</section>`;
   bindVodArrows(home);requestAnimationFrame(()=>updateVodArrows(home));return;
  }
  if(view==='series'){
   const series=all.filter(i=>i.type==='series'||i.type==='tv');
   const current=series.filter(i=>Number(i.year||0)===2026);
   const genreRows=['Ação','Comédia','Drama','Animação','Crime','Mistério','Ficção científica','Fantasia','Documentário','Romance'];
   const featured=rows.find(r=>norm(r.name)==='series em alta')?.items||[];
   const newFeatured=rows.find(r=>norm(r.name)==='series novas de 2026')?.items||[];
   const sections=[['Séries em alta',featured.length?featured:series.filter(i=>i.poster_path).slice(0,28)],['Séries novas de 2026',newFeatured.length?newFeatured:current.slice(0,28)]];
   for(const genre of genreRows){const found=series.filter(i=>(i.genres||[]).some(g=>norm(g)===norm(genre)));if(found.length)sections.push([genre,found.slice(0,28)])}
   home.innerHTML=sections.filter(([,items])=>items.length).map(([name,items])=>shelf(name,items)).join('')+
    `<section class="discover-section vod-last-catalog"><div class="discover-heading"><h2>Catálogo de séries de A a Z</h2></div><div class="vod-letter-buttons">${['#',...Array.from({length:26},(_,i)=>String.fromCharCode(65+i))].map(l=>`<button type="button" data-open-letter="${l}">${l}</button>`).join('')}</div>${shelf('Explorar séries',series.slice(0,28))}</section>`;
   bindVodArrows(home);requestAnimationFrame(()=>updateVodArrows(home));return;
  }
  const movies=all.filter(i=>i.type==='movie');
  const selected=[
   ['Em alta',rows.find(r=>norm(r.name)==='em alta')?.items||[]],
   ['Lançamentos de 2026',rows.find(r=>norm(r.name)==='lancamentos de 2026')?.items||[]]
  ];
  const genres=['Ação','Comédia','Terror','Aventura','Drama','Ficção científica','Suspense','Romance','Animação','Fantasia','Crime','Mistério','Documentário'];
  const aliases={'Ficção científica':['ficcao cientifica','science fiction'],'Suspense':['suspense','thriller']};
  for(const genre of genres){
   const names=(aliases[genre]||[norm(genre)]);
   const matches=movies.filter(i=>Array.isArray(i.genres)&&i.genres.some(g=>names.includes(norm(g))));
   if(matches.length)selected.push([genre,matches.slice(0,28)]);
  }
  const az=Array.from({length:26},(_,i)=>String.fromCharCode(65+i));
  home.innerHTML=selected.filter(([,items])=>items.length).map(([name,items])=>shelf(name,items.filter(i=>i.type==='movie').slice(0,28))).join('')+
  `<section class="discover-section vod-last-catalog"><div class="discover-heading"><h2>Catálogo de A a Z</h2><span>Explore todos os filmes por letra</span></div><div class="vod-letter-buttons">${['#',...az].map(l=>`<button type="button" data-open-letter="${l}">${l}</button>`).join('')}</div>${shelf('Filmes de A a Z',movies.slice(0,28))}</section>`;
  bindVodArrows(home);requestAnimationFrame(()=>updateVodArrows(home));
 }catch(e){home.textContent='Não foi possível carregar as seções de filmes.';console.warn(e)}
}
window.nacaumRenderDiscover=renderDiscover;
document.addEventListener('DOMContentLoaded',()=>{
 const root=document.querySelector('#discoverHome');if(!root)return;
 root.addEventListener('click',e=>{
  const letter=e.target.closest('[data-open-letter]');if(!letter)return;
  const l=letter.dataset.openLetter;
  location.href=`/movies.html?category=${['series','anime','dorama'].includes(discoverView)?discoverView:'movie'}&letter=${encodeURIComponent(l)}&catalog=1`;
 });
 const params=new URLSearchParams(location.search);if(!document.getElementById('homeHero'))renderDiscover(['movie','series','anime','dorama'].includes(params.get('category'))&&!params.has('catalog')?params.get('category'):'home');
});
document.addEventListener('DOMContentLoaded',()=>{if(!document.querySelector("#homeHero"))initDiscover()});
// Abre o mesmo modal de detalhes para os títulos exibidos nas prateleiras.
// A pesquisa de metadados é feita sob demanda; não modifica a ordem das prateleiras.
document.addEventListener('click',async e=>{
 const a=e.target.closest('#discoverHome .discover-card[data-movie-title]');
 if(!a||!window.nacaumOpenCatalogItem)return;
 e.preventDefault();
 try{const all=await catalog();const title=a.dataset.movieTitle;const item=all.find(x=>x.type===a.dataset.movieType&&x.title===title)||{title,type:a.dataset.movieType||'movie'};await window.nacaumOpenCatalogItem(item)}catch(err){console.warn('Não foi possível abrir o perfil',err);location.href=a.href}
});

// Contagem real dos títulos dos catálogos especializados (um @ por obra).
Promise.all(['anime','dorama'].map(async category=>{
 try{const r=await fetch('/api/ondemand?category='+category);if(!r.ok)return;
 const data=await r.json();const el=document.querySelector(`.category-tile.${category} small`);
 if(el&&Number.isFinite(data.count))el.textContent=`${data.count.toLocaleString('pt-BR')} títulos`;
 }catch(e){console.warn('Contagem do catálogo',category,e)}
}));
