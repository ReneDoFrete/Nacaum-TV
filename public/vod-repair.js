/* Ajustes visuais isolados da página On Demand. Não modifica a página inicial. */
(()=>{
 const head=document.querySelector('.movies-head');
 const home=document.querySelector('#discoverHome');
 if(!head||!home)return;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s*\(\d{4}\)\s*$/,'').replace(/[^a-z0-9]+/g,' ').trim();
 let active=0,all=[],initial=null,byTitle=new Map(),byPoster=new Map();
 const original={title:'On Demand',subtitle:'Filmes, séries, animes e doramas. Lançamentos, clássicos e produções completas.'};
 const subtitle=head.querySelector('#pageSubtitle');
 const meta=document.createElement('div');meta.className='vod-hero-meta';
 const synopsis=document.createElement('p');synopsis.className='vod-hero-synopsis';
 subtitle.before(meta);subtitle.after(synopsis);
 const categoryName={movie:'Filme',series:'Série',anime:'Anime',dorama:'Dorama'};
 const renderHero=source=>{
  const match=byPoster.get(source?.poster_path)||byTitle.get(norm(source?.title));
  const item=source?{...match,...source,tmdbId:source.tmdbId||match?.tmdbId,genres:source.genres?.length?source.genres:match?.genres||[],type:source.type||match?.type}:null;
  const token=++active;
  const title=head.querySelector('#pageTitle');
  if(!item){title.textContent=original.title;subtitle.textContent=original.subtitle;meta.replaceChildren();synopsis.textContent='';return}
  title.textContent=item.title;
  const year=String(item.year||'').slice(0,4);
  const type=categoryName[item.type]||'Título';
  const showMeta=(rating,yearValue,genres,runtime)=>{
   const fields=[type,yearValue,rating?'★ '+Number(rating).toFixed(1):'',runtime,...genres].filter(Boolean);
   meta.replaceChildren(...fields.map(value=>{const el=document.createElement('span');el.textContent=value;return el}));
  };
  showMeta(item.vote_average||item.rating,year,Array.isArray(item.genres)?item.genres.slice(0,3).map(g=>typeof g==='string'?g:g.name):[],null);
  subtitle.textContent='';
  synopsis.textContent=item.overview||item.description||'';
  const poster=item.poster_path?.startsWith('/')?`https://image.tmdb.org/t/p/w780${item.poster_path}`:'';
  if(poster)window.nacaumSetVodBackdrop?.(poster);
  if(item.tmdbId){synopsis.textContent ||= 'Carregando sinopse…';fetch('/api/ondemand?'+new URLSearchParams({id:item.tmdbId,type:item.type==='movie'?'movie':'tv'})).then(r=>r.ok?r.json():null).then(d=>{
   if(token!==active||!d)return;
   const bg=d.backdrop_path?`https://image.tmdb.org/t/p/w1280${d.backdrop_path}`:'';
   if(bg)window.nacaumSetVodBackdrop?.(bg);
   const release=String(d.release_date||d.first_air_date||year).slice(0,4);
   const runtime=d.runtime?`${d.runtime} min`:d.number_of_seasons?`${d.number_of_seasons} temporada${d.number_of_seasons===1?'':'s'}`:'';
   showMeta(d.vote_average,release,(d.genres||[]).slice(0,3).map(g=>g.name),runtime);
   synopsis.textContent=d.overview||item.overview||item.description||'Sinopse indisponível.';
  }).catch(()=>{if(token===active&&!synopsis.textContent)synopsis.textContent='Sinopse indisponível.'})}
 };
 const categoryButtons=document.querySelectorAll('.category-grid .category-tile');
 const load=async()=>{
  const [highlights,index]=await Promise.all([fetch('/highlights.json').then(r=>r.json()),fetch('/catalog-index.json').then(r=>r.json())]);
  all=highlights.flatMap(r=>r.items||[]);
  for(const row of index){byTitle.set(norm(row.title),row);if(row.poster_path)byPoster.set(row.poster_path,row)}
  all=all.map(x=>({...byPoster.get(x.poster_path),...byTitle.get(norm(x.title)),...x,tmdbId:x.tmdbId||byPoster.get(x.poster_path)?.tmdbId||byTitle.get(norm(x.title))?.tmdbId}));
  if(all.length)renderHero(all[0]);
  const selectHero=category=>{
   const section=category==='series'?'series em alta':category==='movie'?'em alta':null;
   const row=section?highlights.find(r=>norm(r.name)===section):null;
   const entry=row?.items?.[0];
   if(entry)renderHero(entry);
  };
  const initialCategory=new URLSearchParams(location.search).get('category');
  if(initialCategory)selectHero(initialCategory);
  document.querySelectorAll('[data-category]').forEach(btn=>btn.addEventListener('click',()=>selectHero(btn.dataset.category))); 
  const categoryMap={movie:[],series:[],anime:[],dorama:[]};
  for(const item of index){if(item.type==='movie')categoryMap.movie.push(item);else if(item.type==='series')categoryMap.series.push(item)}
  for(const row of highlights){const name=norm(row.name);if(name==='animes')categoryMap.anime.push(...row.items);if(name==='doramas')categoryMap.dorama.push(...row.items)}
  const unique=items=>[...new Map(items.map(x=>[norm(x.title),x])).values()];
  for(const k of ['movie','series','anime','dorama']){
   const btn=document.querySelector(`.category-grid [data-category="${k}"]`);if(!btn)continue;
   const items=unique(categoryMap[k]);const covers=items.filter(x=>x.poster_path).slice(0,4);
   if(covers.length)btn.style.backgroundImage=`linear-gradient(0deg,rgba(8,11,19,.9),rgba(8,11,19,.08)),${covers.map(x=>`url("https://image.tmdb.org/t/p/w342${x.poster_path}")`).join(',')}`;
   btn.style.backgroundSize=`100% 100%,${covers.map(()=>`${100/covers.length}% 100%`).join(',')}`;
   btn.style.backgroundPosition=`center,${covers.map((_,i)=>`${covers.length===1?0:i*100/(covers.length-1)}% center`).join(',')}`;
   btn.style.backgroundRepeat='no-repeat';
   btn.style.setProperty('--cover-count',covers.length);
   if(k==='movie'||k==='series'){const small=btn.querySelector('small');if(small)small.textContent=`${items.length.toLocaleString('pt-BR')} títulos`;} // anime/dorama: contagem real vem da API
  }
  // Mantém a página e suas fileiras originais; apenas adiciona hover ao banner.
  home.addEventListener('pointerover',e=>{const card=e.target.closest('.discover-card');if(!card||card===home._last)return;home._last=card;const label=card.querySelector('strong')?.textContent||'';const item=all.find(x=>norm(x.title)===norm(label))||byTitle.get(norm(label));if(item)renderHero(item)});
  home.addEventListener('focusin',e=>{const card=e.target.closest('.discover-card');if(!card)return;const label=card.querySelector('strong')?.textContent||'';const item=all.find(x=>norm(x.title)===norm(label))||byTitle.get(norm(label));if(item)renderHero(item)});
  // Banner padrão ao sair da área dos títulos.
  home.addEventListener('pointerleave',()=>{home._last=null});
 };
 load().catch(e=>console.warn('[On Demand] Destaques indisponíveis',e));
})();
