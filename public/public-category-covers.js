(()=>{'use strict';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s*\((?:19|20)\d{2}\)\s*$/,'').replace(/[^a-z0-9]+/g,' ').trim();
const categories=['movie','series','anime','dorama','kids','novela'];
const seenByCategory=new Map();
const poster=x=>x?.poster_path?.startsWith('/')?'https://image.tmdb.org/t/p/w342'+x.poster_path:'';
async function load(){
 const cards=[...document.querySelectorAll('.category-tile[data-category]')];if(!cards.length)return;
 const all=await fetch('/catalog-index.json').then(r=>r.json());
 const lookup=new Map();for(const x of all){const key=norm(x.title);if(x.poster_path&&!lookup.has(key))lookup.set(key,x)}
 await Promise.all(categories.map(async cat=>{
  const card=cards.find(x=>x.dataset.category===cat);if(!card)return;
  let items=all.filter(x=>cat==='movie'?x.type==='movie':x.type==='series'||x.type==='tv');
  if(!['movie','series'].includes(cat)){
   try{const r=await fetch('/api/ondemand?category='+cat);if(!r.ok)return;const data=await r.json();items=data.items||[]}catch{return}
  }
  const unique=[];const seen=new Set();for(const x of items){const key=norm(x.title);if(!key||seen.has(key))continue;seen.add(key);const matched=x.poster_path?x:lookup.get(key);if(poster(matched))unique.push({...x,poster_path:matched.poster_path});}
  seenByCategory.set(cat,unique.length);
  // Mesma seleção de títulos do catálogo, preferindo os primeiros com pôster.
  const first=unique.slice(0,4);if(!first.length)return;
  const strip=document.createElement('span');strip.className='category-cover-strip';strip.setAttribute('aria-hidden','true');
  for(const item of first){const image=document.createElement('img');image.src=poster(item);image.alt='';image.loading='lazy';strip.appendChild(image)}
  card.prepend(strip);
 }));
 if(window.lucide?.createIcons)window.lucide.createIcons();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
