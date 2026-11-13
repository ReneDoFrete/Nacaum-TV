(()=>{
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const poster=p=>typeof p==='string'&&p.startsWith('/')?'https://image.tmdb.org/t/p/w92'+p:'';
const destination=i=>{const type=i.type==='movie'?'movie':i.type==='tv'?'series':i.type;const letter=/^[A-Z]$/.test(i.letter||'')?i.letter:(i.title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').charAt(0).toUpperCase();return '/movies.html?'+new URLSearchParams({category:type||'movie',letter:letter||'#',title:i.title||''})};
let catalogPromise,channelsPromise;
const catalog=()=>catalogPromise??=fetch('/catalog-index.json').then(r=>{if(!r.ok)throw Error('Catálogo indisponível');return r.json()});
const channels=()=>channelsPromise??=fetch('/channels.json').then(r=>{if(!r.ok)throw Error('Canais indisponíveis');return r.json()});
function setup(){
const top=document.querySelector('.topbar');if(!top)return;
const actions=top.querySelector('.top-actions')||top;
// Remove os botões globais antigos para garantir um único botão idêntico em todas as páginas.
top.querySelectorAll('.global-search-button').forEach(x=>x.remove());
const existing=document.getElementById('favoriteSearchToggle');if(existing)existing.remove();
const button=document.createElement('button');button.type='button';button.className='header-search-button nacaum-global-search';button.setAttribute('aria-label','Buscar em todo o Naçaum TV');button.innerHTML='<i data-lucide="search"></i><span>Buscar</span>';actions.prepend(button);
const modal=document.createElement('div');modal.id='globalSearch';modal.className='global-search';modal.hidden=true;modal.innerHTML='<div class="global-search-panel" role="dialog" aria-modal="true" aria-label="Busca geral"><div class="global-search-head"><input type="search" placeholder="Buscar canais, filmes, séries, animes e doramas..." aria-label="Busca geral"><button type="button" aria-label="Fechar">✕</button></div><p id="globalSearchStatus">Digite um título ou canal.</p><div id="globalSearchResults" class="global-search-results"></div></div>';document.body.append(modal);
const input=modal.querySelector('input'),results=modal.querySelector('#globalSearchResults'),status=modal.querySelector('#globalSearchStatus');let timer,seq=0;
function close(){modal.hidden=true;input.value='';results.replaceChildren();button.focus()}
function open(){modal.hidden=false;input.focus()}
button.addEventListener('click',open);modal.querySelector('button').addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open()}});
input.addEventListener('input',()=>{clearTimeout(timer);const q=normalize(input.value.trim()),run=++seq;if(q.length<2){status.textContent='Digite pelo menos 2 caracteres.';results.replaceChildren();return}status.textContent='Pesquisando em todo o catálogo…';timer=setTimeout(async()=>{try{const [all,live]=await Promise.all([catalog(),channels()]);if(run!==seq)return;const found=all.filter(i=>normalize(i.title).includes(q)).slice(0,65);const tv=live.filter(i=>normalize(i.name||i.title).includes(q)).slice(0,12);results.innerHTML=tv.map(i=>`<a href="/live.html#${encodeURIComponent(i.id||'')}" class="global-result"><span>📺</span><strong>${esc(i.name||i.title)}</strong><small>Canal ao vivo</small></a>`).join('')+found.map(i=>`<a href="${destination(i)}" class="global-result">${poster(i.poster_path)?`<img loading="lazy" src="${poster(i.poster_path)}" alt="">`:'<span>🎬</span>'}<strong>${esc(i.title)}</strong><small>${esc(({movie:'Filme',series:'Série',tv:'Série',anime:'Anime',dorama:'Dorama'})[i.type]||'Título')}</small></a>`).join('');status.textContent=`${tv.length+found.length} resultados exibidos${found.length===65?' (refine sua pesquisa)':''}`;if(!tv.length&&!found.length)results.innerHTML='<p>Nenhum resultado encontrado.</p>'}catch(e){if(run===seq)status.textContent='Não foi possível carregar a busca.'}},220)});
if(window.lucide?.createIcons)window.lucide.createIcons();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
