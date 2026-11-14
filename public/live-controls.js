
/* ==========================================
   NAÇAUM TV — CONTROLES DA TV AO VIVO
   Rolagem automática para o canal atual
   ========================================== */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const page = document.body;
  const panel = document.querySelector('.channel-panel');
  const toolbar = $('channelToolbar');
  const panelHost = $('panelFiltersHost');
  const video = $('video');
  const channelList = $('channelList');
  if (!panel || !toolbar || !panelHost || !video || !channelList) return;
  panelHost.append(toolbar);

  let hideTimer;
  let badgeTimer;
  let scrollTimer;
  let lastSelectedId = null;
  let pendingScroll = false;

  /* CANAL ATUAL: o hash é a fonte confiável, mesmo sem window.state. */
  const getSelectedId = () => {
    let hash = location.hash.slice(1);
    try { hash = decodeURIComponent(hash); } catch (_) {}
    return hash.trim() || String(window.state?.selected ?? '').trim() || null;
  };
  const getSelectedItem = () => {
    const id = getSelectedId();
    if (!id) return null;
    return [...channelList.querySelectorAll('.channel-item')]
      .find(item => String(item.dataset.id) === id) || null;
  };
  const scrollToSelectedChannel = (smooth = false) => {
    if (page.classList.contains('channels-closed')) return false;
    const item = getSelectedItem();
    if (!item || !item.getClientRects().length || !channelList.clientHeight) return false;
    const listRect = channelList.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const offset = itemRect.top - listRect.top - channelList.clientHeight / 2 + itemRect.height / 2;
    const max = Math.max(0, channelList.scrollHeight - channelList.clientHeight);
    const target = Math.max(0, Math.min(channelList.scrollTop + offset, max));
    channelList.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'instant' });
    lastSelectedId = getSelectedId();
    return true;
  };
  const scheduleChannelScroll = (smooth = false) => {
    clearTimeout(scrollTimer);
    let attempts = 0;
    const attempt = () => {
      attempts++;
      if (scrollToSelectedChannel(smooth && attempts === 1)) return;
      if (attempts < 30) scrollTimer = setTimeout(attempt, 150);
    };
    requestAnimationFrame(() => requestAnimationFrame(attempt));
  };
  const watchSelectedChannel = () => {
    const id = getSelectedId();
    if (id && id !== lastSelectedId && !pendingScroll) {
      pendingScroll = true;
      scheduleChannelScroll(true);
      setTimeout(() => { pendingScroll = false; }, 250);
    }
  };
  new MutationObserver(() => {
    if (getSelectedItem() && getSelectedId() !== lastSelectedId) scheduleChannelScroll(false);
  }).observe(channelList, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => scheduleChannelScroll(true));
  // replaceState não dispara hashchange; verifica o hash sem depender de state global.
  setInterval(watchSelectedChannel, 350);
  channelList.addEventListener('click', event => {
    if (event.target.closest('[data-fav]')) return;
    if (!event.target.closest('.channel-item')) return;
    setTimeout(() => scheduleChannelScroll(true), 120);
  });
  window.addEventListener('load', () => scheduleChannelScroll(false));

  /* BADGE DO CANAL */
  const revealBadge = () => {
    page.classList.add('live-badge-visible');
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => page.classList.remove('live-badge-visible'), 3200);
  };
  video.addEventListener('mousemove', revealBadge, { passive: true });
  document.querySelector('.video-wrap')?.addEventListener('pointerdown', revealBadge, { passive: true });

  /* INTERFACE E PAINEL */
  let multi = false;
  let choosingSecond = false;
  let secondHls = null;
  let secondId = null;
  const secondVideo = $('secondVideo');
  const fullGuide = $('fullGuide');
  const showUI = () => {
    page.classList.add('live-ui-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (page.classList.contains('guide-open') || (fullGuide && !fullGuide.hidden) || document.activeElement?.closest('.live-controls, .channel-panel')) return;
      page.classList.remove('live-ui-visible');
    }, 3800);
  };
  const setPanel = open => {
    page.classList.toggle('channels-closed', !open);
    showUI();
    if (open) scheduleChannelScroll(false);
  };
  const togglePanel = () => setPanel(page.classList.contains('channels-closed'));
  $('openChannels').onclick = () => setPanel(true);
  $('closeChannels').onclick = () => setPanel(false);
  $('toggleChannels').onclick = togglePanel;

  /* UTILITÁRIOS */
  const fmt = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // O aplicativo original pode declarar state como const global, não como window.state.
  const appState = () => {
    try { return typeof state !== 'undefined' ? state : window.state; }
    catch (_) { return window.state; }
  };
  const getChannels = () => appState()?.channels || [];
  const getGuide = () => appState()?.guide || {};

  /* PROGRAMAÇÃO DO CANAL */
  const currentSchedule = open => {
    page.classList.toggle('guide-open', open);
    const button = $('toggleCurrentSchedule');
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Ocultar programação do canal' : 'Mostrar programação do canal');
    button.title = open ? 'Ocultar programação do canal' : 'Mostrar programação do canal';
    showUI();
  };
  $('toggleCurrentSchedule').onclick = () => currentSchedule(!page.classList.contains('guide-open'));
  $('closeCurrentSchedule').onclick = () => currentSchedule(false);

  /* GUIA COMPLETO */
  const renderFullGuide = () => {
    const query = $('fullGuideSearch').value.trim().toLocaleLowerCase('pt-BR');
    const channels = getChannels().filter(c => String(c.name || '').toLocaleLowerCase('pt-BR').includes(query));
    const now = Date.now();
    const hour = 30 * 60 * 1000;
    const start = Math.floor(now / hour) * hour - hour;
    const timeSlots = Array.from({ length: 12 }, (_, i) => start + i * hour);
    const header = ['<div class="epg-channel epg-heading">CANAL</div>', ...timeSlots.map(t => `<div class="epg-time">${fmt(t)}</div>`)].join('');
    const guideData = getGuide();
    const rows = channels.map((channel, idx) => {
      const guide = guideData[channel.id] || {};
      const programs = Array.isArray(guide.schedule) && guide.schedule.length ? guide.schedule : (guide.title ? [guide] : []);
      const cells = timeSlots.map(t => {
        const item = programs.find(x => x.start <= t + hour / 2 && x.end > t + hour / 2);
        const current = item && item.start <= now && item.end > now;
        return `<div class="epg-program ${current ? 'epg-current' : ''}" title="${esc(item?.title || 'Sem programação disponível')}"><strong>${esc(item?.title || 'Sem programação')}</strong>${item ? `<small>${fmt(item.start)} – ${fmt(item.end)}</small>` : ''}</div>`;
      }).join('');
      return `<button class="epg-channel epg-select" data-channel="${esc(channel.id)}"><span>${idx + 1}</span>${channel.logo ? `<img src="${esc(channel.logo)}" alt="" loading="lazy">` : ''}<strong>${esc(channel.name)}</strong></button>${cells}`;
    }).join('');
    $('fullGuideGrid').innerHTML = header + rows;
    $('fullGuideGrid').querySelectorAll('.epg-select').forEach(button => {
      button.onclick = () => {
        history.replaceState(null, '', `#${encodeURIComponent(button.dataset.channel)}`);
        selectChannel(button.dataset.channel);
        closeFullGuide();
        scheduleChannelScroll(true);
      };
    });
    $('guideDate').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('fullGuideGrid').style.setProperty('--guide-columns', String(timeSlots.length));
  };
  const closeFullGuide = () => { fullGuide.hidden = true; showUI(); };
  $('toggleGuide').onclick = () => {
    currentSchedule(false);
    renderFullGuide();
    fullGuide.hidden = false;
    showUI();
    $('fullGuideSearch').focus();
  };
  $('closeFullGuide').onclick = closeFullGuide;
  $('fullGuideSearch').addEventListener('input', renderFullGuide);
  $('guideNow').onclick = () => {
    renderFullGuide();
    $('fullGuideGrid').closest('.full-guide-scroll')?.scrollTo({ left: 0, behavior: 'smooth' });
  };
  const updateProgramBadge = () => {
    const selected = getSelectedId() || appState()?.selected;
    const channel = getChannels().find(c => String(c.id) === String(selected));
    if (!channel) return;
    const guide = getGuide()[channel.id];
    $('playingCategory').textContent = guide?.title || 'Programação indisponível';
  };
  document.addEventListener('nacaum-guide-updated', () => {
    if (!fullGuide.hidden) renderFullGuide();
    updateProgramBadge();
  });
  new MutationObserver(updateProgramBadge).observe($('playingName'), { childList: true, characterData: true, subtree: true });
  updateProgramBadge();

  /* VOLUME */
  $('liveVolume').oninput = event => {
    video.volume = Number(event.target.value) / 100;
    video.muted = false;
    $('toggleMute').textContent = '🔊';
    showUI();
  };
  $('toggleMute').onclick = () => {
    video.muted = !video.muted;
    $('toggleMute').textContent = video.muted ? '🔇' : '🔊';
    showUI();
  };

  /* PLAY / PAUSE */
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
    if (video.paused) {
      try { await video.play(); } catch (error) { console.warn('Não foi possível reproduzir:', error); }
    } else video.pause();
    syncPlaybackIcon();
    showUI();
  };

  /* CANAL ANTERIOR / PRÓXIMO */
  const switchChannel = delta => {
    const channels = getChannels();
    if (!channels.length) return;
    const selected = getSelectedId() || appState()?.selected;
    const index = channels.findIndex(c => String(c.id) === String(selected));
    const next = channels[(index + delta + channels.length) % channels.length];
    if (next) {
      history.replaceState(null, '', `#${encodeURIComponent(next.id)}`);
      selectChannel(next.id);
      scheduleChannelScroll(true);
    }
    showUI();
  };
  $('previousChannel').onclick = () => switchChannel(-1);
  $('nextChannel').onclick = () => switchChannel(1);

  /* TELA CHEIA */
  $('toggleFullscreen').onclick = async () => {
    const wrapper = document.querySelector('.video-wrap');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (wrapper?.requestFullscreen) await wrapper.requestFullscreen();
      else if (video.requestFullscreen) await video.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    } catch (error) {
      if (video.webkitEnterFullscreen) {
        try { video.webkitEnterFullscreen(); }
        catch (fallbackError) { console.warn('Tela cheia indisponível:', fallbackError); }
      } else console.warn('Tela cheia indisponível:', error);
    }
    showUI();
  };

  /* PICTURE-IN-PICTURE */
  $('togglePip').onclick = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled && video.readyState > 0) await video.requestPictureInPicture();
    } catch (error) { console.warn('Picture-in-Picture indisponível:', error); }
    showUI();
  };

  /* MULTITELAS */
  const clearSecond = () => {
    secondHls?.destroy();
    secondHls = null;
    if (secondVideo) {
      secondVideo.pause();
      secondVideo.removeAttribute('src');
      secondVideo.load();
      secondVideo.style.display = 'none';
    }
    $('secondEmpty').style.display = 'block';
    secondId = null;
  };
  const closeMulti = () => {
    multi = false;
    choosingSecond = false;
    clearSecond();
    $('multiView').hidden = true;
    page.classList.remove('multi-active');
    $('toggleMulti').classList.remove('active');
    showUI();
  };
  $('toggleMulti').onclick = () => {
    if (multi) return closeMulti();
    multi = true;
    choosingSecond = true;
    $('multiView').hidden = false;
    page.classList.add('multi-active');
    $('toggleMulti').classList.add('active');
    setPanel(true);
    showUI();
  };
  $('closeSecond').onclick = closeMulti;
  $('chooseSecond').onclick = () => { choosingSecond = true; setPanel(true); };
  const loadSecond = channel => {
    const source = (channel.sources || [])[0];
    if (!source) {
      $('secondEmpty').querySelector('p').textContent = 'Este canal não possui fonte disponível.';
      return;
    }
    clearSecond();
    secondId = channel.id;
    const url = buildStreamUrl(source);
    $('secondEmpty').style.display = 'none';
    secondVideo.style.display = 'block';
    if (window.Hls && Hls.isSupported()) {
      secondHls = new Hls({ enableWorker: true });
      secondHls.loadSource(url);
      secondHls.attachMedia(secondVideo);
      secondHls.on(Hls.Events.MANIFEST_PARSED, () => secondVideo.play().catch(() => {}));
      secondHls.on(Hls.Events.ERROR, (_event, error) => {
        if (error.fatal) {
          $('secondEmpty').style.display = 'block';
          $('secondEmpty').querySelector('p').textContent = 'Falha na reprodução da segunda tela.';
        }
      });
    } else if (secondVideo.canPlayType('application/vnd.apple.mpegurl')) {
      secondVideo.src = url;
      secondVideo.play().catch(() => {});
    } else {
      $('secondEmpty').style.display = 'block';
      $('secondEmpty').querySelector('p').textContent = 'Navegador sem suporte a HLS.';
    }
    choosingSecond = false;
    setPanel(false);
  };
  channelList.addEventListener('click', event => {
    if (!multi || !choosingSecond || event.target.closest('[data-fav]')) return;
    const item = event.target.closest('.channel-item');
    if (!item) return;
    const channel = getChannels().find(c => String(c.id) === String(item.dataset.id));
    if (!channel) return;
    event.stopImmediatePropagation();
    loadSecond(channel);
  }, true);

  /* NOME DO CANAL ATUAL */
  const updateCurrent = () => { $('liveCurrentName').textContent = $('playingName')?.textContent || 'Ao vivo'; };
  new MutationObserver(updateCurrent).observe($('playingName'), { childList: true, characterData: true, subtree: true });
  updateCurrent();

  /* EVENTOS DA INTERFACE */
  $('ao-vivo').addEventListener('mousemove', showUI, { passive: true });
  $('ao-vivo').addEventListener('pointerdown', showUI, { passive: true });
  $('ao-vivo').addEventListener('touchstart', showUI, { passive: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      currentSchedule(false);
      closeFullGuide();
      if (multi) closeMulti();
    }
    showUI();
  });

  /* INICIALIZAÇÃO */
  setPanel(true);
  showUI();
  scheduleChannelScroll(false);
})();
