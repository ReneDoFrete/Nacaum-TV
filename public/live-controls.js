/* Controles de TV independentes do catálogo e das fontes existentes. */
(() => {
  const $ = (id) => document.getElementById(id);
  const page = document.body;
  const panel = document.querySelector('.channel-panel');
  const toolbar = $('channelToolbar');
  const panelHost = $('panelFiltersHost');
  const video = $('video');
  if (!panel || !toolbar || !video) return;
  panelHost.append(toolbar);
  let hideTimer;
  let badgeTimer;
  const revealBadge = () => {
    page.classList.add('live-badge-visible');
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => page.classList.remove('live-badge-visible'), 3200);
  };
  $('video').addEventListener('mousemove', revealBadge, {passive:true});
  document.querySelector('.video-wrap').addEventListener('pointerdown', revealBadge, {passive:true});
  let multi = false;
  let choosingSecond = false;
  let secondHls = null;
  let secondId = null;
  const secondVideo = $('secondVideo');
  const showUI = () => {
    page.classList.add('live-ui-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (page.classList.contains('guide-open') || !document.getElementById('fullGuide').hidden || document.activeElement?.closest('.live-controls, .channel-panel')) return;
      page.classList.remove('live-ui-visible');
    }, 3800);
  };
  const setPanel = (open) => { page.classList.toggle('channels-closed', !open); showUI(); };
  const togglePanel = () => setPanel(page.classList.contains('channels-closed'));
  $('openChannels').onclick = () => setPanel(true);
  $('closeChannels').onclick = () => setPanel(false);
  $('toggleChannels').onclick = togglePanel;
  const fmt = (t) => new Date(t).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentSchedule = (open) => {
    page.classList.toggle('guide-open', open);
    $('toggleCurrentSchedule').setAttribute('aria-expanded', String(open));
    $('toggleCurrentSchedule').setAttribute('aria-label', open ? 'Ocultar programação do canal' : 'Mostrar programação do canal');
    $('toggleCurrentSchedule').title = open ? 'Ocultar programação do canal' : 'Mostrar programação do canal';
    showUI();
  };
  $('toggleCurrentSchedule').onclick = () => currentSchedule(!page.classList.contains('guide-open'));
  $('closeCurrentSchedule').onclick = () => currentSchedule(false);
  const fullGuide = $('fullGuide');
  const renderFullGuide = () => {
    const query = $('fullGuideSearch').value.trim().toLocaleLowerCase('pt-BR');
    const channels = (window.state?.channels || state.channels).filter(c => c.name.toLocaleLowerCase('pt-BR').includes(query));
    const now = Date.now(), hour = 30 * 60 * 1000;
    const start = Math.floor(now/hour)*hour - hour;
    const end = start + 12*hour;
    const timeSlots = Array.from({length:12}, (_,i)=>start+i*hour);
    const html = ['<div class="epg-channel epg-heading">CANAL</div>',...timeSlots.map(t=>`<div class="epg-time">${fmt(t)}</div>`)].join('');
    const rows = channels.map((channel,idx) => {
      const guide = state.guide[channel.id] || {};
      const programs = Array.isArray(guide.schedule) && guide.schedule.length ? guide.schedule : (guide.title ? [guide] : []);
      const cells = timeSlots.map(t => {
        const item = programs.find(x=>x.start <= t+hour/2 && x.end > t+hour/2);
        const current = item && item.start <= now && item.end > now;
        return `<div class="epg-program ${current?'epg-current':''}" title="${esc(item?.title || 'Sem programação disponível')}"><strong>${esc(item?.title || 'Sem programação')}</strong>${item ? `<small>${fmt(item.start)} – ${fmt(item.end)}</small>` : ''}</div>`;
      }).join('');
      return `<button class="epg-channel epg-select" data-channel="${esc(channel.id)}"><span>${idx+1}</span>${channel.logo?`<img src="${esc(channel.logo)}" alt="" loading="lazy">`:''}<strong>${esc(channel.name)}</strong></button>${cells}`;
    }).join('');
    $('fullGuideGrid').innerHTML = html + rows || '<p>Não há canais disponíveis.</p>';
    $('fullGuideGrid').querySelectorAll('.epg-select').forEach(b=>b.onclick=()=>{
      history.replaceState(null,'',`#${encodeURIComponent(b.dataset.channel)}`);
      selectChannel(b.dataset.channel);
      closeFullGuide();
    });
    $('guideDate').textContent = new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
    $('fullGuideGrid').style.setProperty('--guide-columns', String(timeSlots.length));
  };
  const closeFullGuide = () => { fullGuide.hidden = true; showUI(); };
  $('toggleGuide').onclick = () => { currentSchedule(false); renderFullGuide(); fullGuide.hidden = false; showUI(); $('fullGuideSearch').focus(); };
  $('closeFullGuide').onclick = closeFullGuide;
  $('fullGuideSearch').addEventListener('input',renderFullGuide);
  $('guideNow').onclick = () => { renderFullGuide(); $('fullGuideGrid').closest('.full-guide-scroll').scrollTo({left:0,behavior:'smooth'}); };
  // O guia é atualizado quando os dados da programação terminam de carregar.
  document.addEventListener('nacaum-guide-updated',()=>{ if(!fullGuide.hidden) renderFullGuide(); updateProgramBadge(); });
  const updateProgramBadge = () => {
    const channel = state.channels.find(c=>c.id===state.selected);
    if (!channel) return;
    const guide = state.guide[channel.id];
    $('playingCategory').textContent = guide?.title || 'Programação indisponível';
  };
  const currentObserver = new MutationObserver(updateProgramBadge);
  currentObserver.observe($('playingName'),{childList:true,characterData:true,subtree:true});
  updateProgramBadge();
  $('liveVolume').oninput = (event) => { video.volume = Number(event.target.value) / 100; video.muted = false; $('toggleMute').textContent = '🔊'; showUI(); };
  $('toggleMute').onclick = () => { video.muted = !video.muted; $('toggleMute').textContent = video.muted ? '🔇' : '🔊'; showUI(); };
  const playSvg = '<svg class="control-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m8 5 12 7-12 7z"/></svg>';
  const pauseSvg = '<svg class="control-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  const syncPlaybackIcon = () => {
    const paused = video.paused || video.ended;
    const button = $('togglePlayback');
    button.innerHTML = paused ? playSvg : pauseSvg;
    button.title = paused ? 'Reproduzir (pausado)' : 'Pausar (reproduzindo)';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(!paused));
  };
  ['play', 'playing', 'pause', 'ended', 'emptied', 'loadedmetadata'].forEach(event => video.addEventListener(event, syncPlaybackIcon));
  syncPlaybackIcon();
  $('togglePlayback').onclick = async () => {
    if (video.paused) { try { await video.play(); } catch (error) { console.warn('Não foi possível reproduzir:', error); } }
    else video.pause();
    syncPlaybackIcon(); showUI();
  };
  const switchChannel = (delta) => {
    if (!Array.isArray(state.channels) || !state.channels.length) return;
    const index = state.channels.findIndex(c => c.id === state.selected);
    const next = state.channels[(index + delta + state.channels.length) % state.channels.length];
    if (next) { history.replaceState(null, '', `#${next.id}`); selectChannel(next.id); }
    showUI();
  };
  $('previousChannel').onclick = () => switchChannel(-1);
  $('nextChannel').onclick = () => switchChannel(1);
  $('toggleFullscreen').onclick = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('ao-vivo').requestFullscreen(); }
    catch (e) { console.warn('Tela cheia indisponível:', e); }
    showUI();
  };
  $('togglePip').onclick = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled && video.readyState > 0) await video.requestPictureInPicture();
    } catch (e) { console.warn('Picture-in-Picture indisponível:', e); }
    showUI();
  };
  const clearSecond = () => {
    secondHls?.destroy(); secondHls = null;
    secondVideo.pause(); secondVideo.removeAttribute('src'); secondVideo.load();
    secondVideo.style.display = 'none'; $('secondEmpty').style.display = 'block'; secondId = null;
  };
  const closeMulti = () => { multi = false; choosingSecond = false; clearSecond(); $('multiView').hidden = true; page.classList.remove('multi-active'); $('toggleMulti').classList.remove('active'); showUI(); };
  $('toggleMulti').onclick = () => {
    if (multi) return closeMulti();
    multi = true; choosingSecond = true;
    $('multiView').hidden = false; page.classList.add('multi-active');
    $('toggleMulti').classList.add('active'); setPanel(true); showUI();
  };
  $('closeSecond').onclick = closeMulti;
  $('chooseSecond').onclick = () => { choosingSecond = true; setPanel(true); };
  const loadSecond = (channel) => {
    const source = (channel.sources || [])[0];
    if (!source) { $('secondEmpty').querySelector('p').textContent = 'Este canal não possui fonte disponível.'; return; }
    clearSecond(); secondId = channel.id;
    const url = buildStreamUrl(source);
    $('secondEmpty').style.display = 'none'; secondVideo.style.display = 'block';
    if (window.Hls && Hls.isSupported()) {
      secondHls = new Hls({enableWorker:true}); secondHls.loadSource(url); secondHls.attachMedia(secondVideo);
      secondHls.on(Hls.Events.MANIFEST_PARSED, () => secondVideo.play().catch(() => {}));
      secondHls.on(Hls.Events.ERROR, (_event, error) => { if (error.fatal) { $('secondEmpty').style.display = 'block'; $('secondEmpty').querySelector('p').textContent = 'Falha na reprodução da segunda tela.'; } });
    } else if (secondVideo.canPlayType('application/vnd.apple.mpegurl')) {
      secondVideo.src = url; secondVideo.play().catch(() => {});
    } else { $('secondEmpty').style.display = 'block'; $('secondEmpty').querySelector('p').textContent = 'Navegador sem suporte a HLS.'; }
    choosingSecond = false; setPanel(false);
  };
  // Captura apenas o clique de seleção quando o usuário estiver escolhendo a Tela 2.
  $('channelList').addEventListener('click', (event) => {
    if (!multi || !choosingSecond || event.target.closest('[data-fav]')) return;
    const item = event.target.closest('.channel-item');
    if (!item) return;
    const channel = state.channels.find(c => c.id === item.dataset.id);
    if (!channel) return;
    event.stopImmediatePropagation();
    loadSecond(channel);
  }, true);
  const updateCurrent = () => { $('liveCurrentName').textContent = $('playingName')?.textContent || 'Ao vivo'; };
  new MutationObserver(updateCurrent).observe($('playingName'), {childList:true,characterData:true,subtree:true}); updateCurrent();
  $('ao-vivo').addEventListener('mousemove', showUI, {passive:true});
  $('ao-vivo').addEventListener('pointerdown', showUI, {passive:true});
  $('ao-vivo').addEventListener('touchstart', showUI, {passive:true});
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { currentSchedule(false); closeFullGuide(); if (multi) closeMulti(); } showUI(); });
  // Ao entrar, vídeo limpo; botões aparecem com o movimento do mouse.
  setPanel(true); showUI();
})();
