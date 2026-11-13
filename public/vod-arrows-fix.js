/* Navegação dos carrosséis On Demand, inclusive os gêneros carregados depois. */
(()=>{
  const root=document.getElementById('discoverHome');
  if(!root)return;
  const bind=()=>{
    root.querySelectorAll('.vod-rail-shell').forEach(shell=>{
      if(shell.dataset.arrowsFixed==='1')return;
      const rail=shell.querySelector('.discover-rail');
      if(!rail)return;
      shell.dataset.arrowsFixed='1';
      const prev=shell.querySelector('.vod-arrow.prev');
      const next=shell.querySelector('.vod-arrow.next');
      const update=()=>{
        const max=Math.max(0,rail.scrollWidth-rail.clientWidth);
        if(prev)prev.disabled=max<3||rail.scrollLeft<=2;
        if(next)next.disabled=max<3||rail.scrollLeft>=max-2;
      };
      const move=(direction)=>{
        const amount=Math.max(280,Math.round(rail.clientWidth*.8));
        rail.scrollBy({left:direction*amount,behavior:'smooth'});
      };
      // Handler próprio para garantir que as setas funcionem após renderizações assíncronas.
      if(prev)prev.addEventListener('click',e=>{e.stopImmediatePropagation();move(-1)},true);
      if(next)next.addEventListener('click',e=>{e.stopImmediatePropagation();move(1)},true);
      rail.addEventListener('scroll',update,{passive:true});
      window.addEventListener('resize',update,{passive:true});
      if('ResizeObserver'in window)new ResizeObserver(update).observe(rail);
      rail.querySelectorAll('img').forEach(img=>img.addEventListener('load',update,{once:true}));
      requestAnimationFrame(()=>requestAnimationFrame(update));
    });
  };
  new MutationObserver(bind).observe(root,{childList:true,subtree:true});
  bind();
})();
