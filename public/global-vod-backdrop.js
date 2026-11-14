/* Fundo cinematográfico compartilhado: Início e Favoritos. */
(()=>{
 if(!document.querySelector('#homeHero')&&!document.querySelector('.favorite-page'))return;
 const layers=[document.createElement('div'),document.createElement('div')];
 layers.forEach(el=>{el.className='vod-full-backdrop';el.setAttribute('aria-hidden','true');document.body.prepend(el)});
 let front=0,sequence=0,last='';
 window.nacaumSetVodBackdrop=(url)=>{
  if(!url||url===last)return;
  const id=++sequence,img=new Image();
  img.onload=()=>{if(id!==sequence)return;const next=1-front;layers[next].style.backgroundImage=`url(${JSON.stringify(url)})`;layers[next].classList.add('visible');layers[front].classList.remove('visible');front=next;last=url};
  img.onerror=()=>{};img.src=url;
 };
})();
