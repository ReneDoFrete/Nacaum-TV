/* Fundo global com crossfade para a página On Demand. */
(()=>{
  if(!document.querySelector('#discoverHome')&&!document.querySelector('#homeHero')&&!document.querySelector('.favorite-page'))return;
  const layers=[document.createElement('div'),document.createElement('div')];
  layers.forEach((el,i)=>{el.className='vod-full-backdrop';el.setAttribute('aria-hidden','true');document.body.prepend(el)});
  let front=0,sequence=0,lastUrl='';
  window.nacaumSetVodBackdrop=(url)=>{
    if(!url||url===lastUrl)return;
    const id=++sequence;
    const img=new Image();
    img.onload=()=>{
      if(id!==sequence)return;
      const next=1-front;
      layers[next].style.backgroundImage=`url(${JSON.stringify(url)})`;
      layers[next].classList.add('visible');
      layers[front].classList.remove('visible');
      front=next;lastUrl=url;
    };
    img.src=url;
  };
})();
