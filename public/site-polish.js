
(()=> {
  function clock(){const el=document.getElementById('clock');if(el)el.textContent=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
  clock();setInterval(clock,30000);
  const input=document.getElementById('favoriteSearchInput');
  if(input){
    input.addEventListener('input',()=>{
      const q=input.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      document.querySelectorAll('.favorite-tile').forEach(card=>{
        const title=(card.querySelector('strong')?.textContent||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        card.hidden=!!q&&!title.includes(q);
      });
    });
    for(const id of ['favoriteVod','favoriteChannels']){const grid=document.getElementById(id);if(grid)new MutationObserver(()=>{if(input.value)input.dispatchEvent(new Event('input'));}).observe(grid,{childList:true});}
  }
})();
