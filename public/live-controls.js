
/* ==========================================
   NAÇAUM TV — CONTROLES DA TV AO VIVO
   Rolagem automática pelo nome do canal
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

  if (!panel || !toolbar || !panelHost || !video || !channelList) {
    return;
  }

  panelHost.append(toolbar);

  let hideTimer;
  let badgeTimer;

  /* ==========================================
     ESTADO DO APLICATIVO
     ========================================== */

  const appState = () => {
    try {
      if (typeof state !== 'undefined') return state;
    } catch (_) {}

    return window.state || {};
  };

  const getChannels = () => {
    return appState().channels || [];
  };

  const getGuide = () => {
    return appState().guide || {};
  };

  /* ==========================================
     ROLAGEM AUTOMÁTICA DOS CANAIS
     ========================================== */

  let scrollTimer = null;
  let lastSelectedName = '';
  let lastSelectedId = '';
  let scrollAttempts = 0;

  const normalizeChannelName = value => {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  };

  // Lê o nome mostrado no botão circulado.
  const getCurrentChannelName = () => {
    const playingName = $('playingName')?.textContent?.trim();
    const currentName = $('liveCurrentName')?.textContent?.trim();

    if (currentName && currentName !== 'Ao vivo') {
      return currentName;
    }

    return playingName || currentName || '';
  };

  const getSelectedItem = () => {
    const name = normalizeChannelName(
      getCurrentChannelName()
    );

    if (!name || name === 'ao vivo') {
      return null;
    }

    const items = [
      ...channelList.querySelectorAll('.channel-item')
    ];

    // Primeiro procura o canal pelo nome no catálogo.
    const channel = getChannels().find(c => {
      return normalizeChannelName(c.name) === name;
    });

    if (channel) {
      const item = items.find(element => {
        return String(element.dataset.id) ===
          String(channel.id);
      });

      if (item) return item;
    }

    // Se não houver catálogo acessível,
    // procura diretamente pelo texto do card.
    return items.find(item => {
      const nameElement = item.querySelector(
        '.channel-name, .channel-title, strong'
      );

      return normalizeChannelName(
        nameElement?.textContent
      ) === name;
    }) || null;
  };

  const scrollToSelectedChannel = (smooth = false) => {
    if (page.classList.contains('channels-closed')) {
      return false;
    }

    const item = getSelectedItem();

    if (!item || !channelList.clientHeight) {
      return false;
    }

    if (!item.getClientRects().length) {
      return false;
    }

    const listRect = channelList.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    const offset =
      itemRect.top -
      listRect.top -
      channelList.clientHeight / 2 +
      itemRect.height / 2;

    const maxScroll = Math.max(
      0,
      channelList.scrollHeight - channelList.clientHeight
    );

    const target = Math.max(
      0,
      Math.min(
        channelList.scrollTop + offset,
        maxScroll
      )
    );

    channelList.scrollTo({
      top: target,
      behavior: smooth ? 'smooth' : 'instant'
    });

    lastSelectedName = normalizeChannelName(
      getCurrentChannelName()
    );

    lastSelectedId = String(item.dataset.id || '');

    return true;
  };

  const scheduleChannelScroll = (smooth = false) => {
    clearTimeout(scrollTimer);

    scrollAttempts = 0;

    const attempt = () => {
      scrollAttempts++;

      if (
        scrollToSelectedChannel(
          smooth && scrollAttempts === 1
        )
      ) {
        return;
      }

      if (scrollAttempts < 40) {
        scrollTimer = setTimeout(attempt, 150);
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(attempt);
    });
  };

  const watchSelectedChannel = () => {
    const name = normalizeChannelName(
      getCurrentChannelName()
    );

    if (
      name &&
      name !== 'ao vivo' &&
      name !== lastSelectedName &&
      !page.classList.contains('channels-closed')
    ) {
      scheduleChannelScroll(false);
    }
  };

  // Observa a lista quando os canais carregam.
  new MutationObserver(() => {
    const item = getSelectedItem();

    if (
      item &&
      String(item.dataset.id) !== lastSelectedId
    ) {
      scheduleChannelScroll(false);
    }
  }).observe(channelList, {
    childList: true,
    subtree: true
  });

  // Observa o nome do canal exibido no player.
  const currentChannelLabel =
    $('liveCurrentName') || $('playingName');

  if (currentChannelLabel) {
    new MutationObserver(() => {
      const name = normalizeChannelName(
        getCurrentChannelName()
      );

      if (
        name &&
        name !== 'ao vivo' &&
        name !== lastSelectedName
      ) {
        scheduleChannelScroll(true);
      }
    }).observe(currentChannelLabel, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  // Acompanha inicializações e trocas feitas
  // por outros scripts da página.
  setInterval(watchSelectedChannel, 500);

  // Ao clicar em um canal da lista.
  channelList.addEventListener('click', event => {
    if (event.target.closest('[data-fav]')) {
      return;
    }

    const item = event.target.closest('.channel-item');

    if (!item) return;

    setTimeout(() => {
      scheduleChannelScroll(true);
    }, 150);
  });

  // Quando a página terminar de carregar.
  window.addEventListener('load', () => {
    scheduleChannelScroll(false);
  });

  /* ==========================================
     BADGE DO CANAL
     ========================================== */

  const revealBadge = () => {
    page.classList.add('live-badge-visible');

    clearTimeout(badgeTimer);

    badgeTimer = setTimeout(() => {
      page.classList.remove('live-badge-visible');
    }, 3200);
  };

  video.addEventListener('mousemove', revealBadge, {
    passive: true
  });

  document.querySelector('.video-wrap')?.addEventListener(
    'pointerdown',
    revealBadge,
    { passive: true }
  );

  /* ==========================================
     INTERFACE E PAINEL
     ========================================== */

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
      if (
        page.classList.contains('guide-open') ||
        (fullGuide && !fullGuide.hidden) ||
        document.activeElement?.closest(
          '.live-controls, .channel-panel'
        )
      ) {
        return;
      }

      page.classList.remove('live-ui-visible');
    }, 3800);
  };

  const setPanel = open => {
    page.classList.toggle('channels-closed', !open);

    showUI();

    if (open) {
      scheduleChannelScroll(false);
    }
  };

  const togglePanel = () => {
    setPanel(
      page.classList.contains('channels-closed')
    );
  };

  $('openChannels').onclick = () => setPanel(true);
  $('closeChannels').onclick = () => setPanel(false);
  $('toggleChannels').onclick = togglePanel;

  /* ==========================================
     UTILITÁRIOS
     ========================================== */

  const fmt = t => {
    return new Date(t).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const esc = value => {
    return String(value ?? '').replace(
      /[&<>"']/g,
      char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char])
    );
  };

  /* ==========================================
     PROGRAMAÇÃO DO CANAL
     ========================================== */

  const currentSchedule = open => {
    page.classList.toggle('guide-open', open);

    const button = $('toggleCurrentSchedule');

    button.setAttribute(
      'aria-expanded',
      String(open)
    );

    button.setAttribute(
      'aria-label',
      open
        ? 'Ocultar programação do canal'
        : 'Mostrar programação do canal'
    );

    button.title = open
      ? 'Ocultar programação do canal'
      : 'Mostrar programação do canal';

    showUI();
  };

  $('toggleCurrentSchedule').onclick = () => {
    currentSchedule(
      !page.classList.contains('guide-open')
    );
  };

  $('closeCurrentSchedule').onclick = () => {
    currentSchedule(false);
  };

  /* ==========================================
     GUIA COMPLETO
     ========================================== */

  const renderFullGuide = () => {
    const query = $('fullGuideSearch')
      .value
      .trim()
      .toLocaleLowerCase('pt-BR');

    const channels = getChannels().filter(channel => {
      return String(channel.name || '')
        .toLocaleLowerCase('pt-BR')
        .includes(query);
    });

    const now = Date.now();
    const hour = 30 * 60 * 1000;

    const start =
      Math.floor(now / hour) * hour - hour;

    const timeSlots = Array.from(
      { length: 12 },
      (_, i) => start + i * hour
    );

    const header = [
      '<div class="epg-channel epg-heading">CANAL</div>',
      ...timeSlots.map(
        time => `<div class="epg-time">${fmt(time)}</div>`
      )
    ].join('');

    const guideData = getGuide();

    const rows = channels.map((channel, index) => {
      const guide = guideData[channel.id] || {};

      const programs =
        Array.isArray(guide.schedule) &&
        guide.schedule.length
          ? guide.schedule
          : guide.title
            ? [guide]
            : [];

      const cells = timeSlots.map(time => {
        const item = programs.find(program => {
          return (
            program.start <= time + hour / 2 &&
            program.end > time + hour / 2
          );
        });

        const current =
          item &&
          item.start <= now &&
          item.end > now;

        return `
          <div
            class="epg-program ${
              current ? 'epg-current' : ''
            }"
            title="${
              esc(item?.title || 'Sem programação disponível')
            }"
          >
            <strong>${
              esc(item?.title || 'Sem programação')
            }</strong>

            ${
              item
                ? `<small>${
                    fmt(item.start)
                  } – ${
                    fmt(item.end)
                  }</small>`
                : ''
            }
          </div>
        `;
      }).join('');

      return `
        <button
          class="epg-channel epg-select"
          data-channel="${esc(channel.id)}"
        >
          <span>${index + 1}</span>

          ${
            channel.logo
              ? `<img
                  src="${esc(channel.logo)}"
                  alt=""
                  loading="lazy"
                >`
              : ''
          }

          <strong>${esc(channel.name)}</strong>
        </button>

        ${cells}
      `;
    }).join('');

    $('fullGuideGrid').innerHTML = header + rows;

    $('fullGuideGrid')
      .querySelectorAll('.epg-select')
      .forEach(button => {
        button.onclick = () => {
          const id = button.dataset.channel;

          history.replaceState(
            null,
            '',
            `#${encodeURIComponent(id)}`
          );

          selectChannel(id);

          closeFullGuide();

          scheduleChannelScroll(true);
        };
      });

    $('guideDate').textContent =
      new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });

    $('fullGuideGrid').style.setProperty(
      '--guide-columns',
      String(timeSlots.length)
    );
  };

  const closeFullGuide = () => {
    fullGuide.hidden = true;
    showUI();
  };

  $('toggleGuide').onclick = () => {
    currentSchedule(false);
    renderFullGuide();

    fullGuide.hidden = false;

    showUI();

    $('fullGuideSearch').focus();
  };

  $('closeFullGuide').onclick = closeFullGuide;

  $('fullGuideSearch').addEventListener(
    'input',
    renderFullGuide
  );

  $('guideNow').onclick = () => {
    renderFullGuide();

    $('fullGuideGrid')
      .closest('.full-guide-scroll')
      ?.scrollTo({
        left: 0,
        behavior: 'smooth'
      });
  };

  /* ==========================================
     BADGE DA PROGRAMAÇÃO
     ========================================== */

  const updateProgramBadge = () => {
    const currentName = normalizeChannelName(
      getCurrentChannelName()
    );

    const channel = getChannels().find(c => {
      return normalizeChannelName(c.name) === currentName;
    });

    if (!channel) return;

    const guide = getGuide()[channel.id];

    $('playingCategory').textContent =
      guide?.title || 'Programação indisponível';
  };

  document.addEventListener(
    'nacaum-guide-updated',
    () => {
      if (!fullGuide.hidden) {
        renderFullGuide();
      }

      updateProgramBadge();
    }
  );

  const playingName = $('playingName');

  if (playingName) {
    new MutationObserver(updateProgramBadge).observe(
      playingName,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );
  }

  updateProgramBadge();

  /* ==========================================
     VOLUME
     ========================================== */

  $('liveVolume').oninput = event => {
    video.volume = Number(event.target.value) / 100;
    video.muted = false;

    $('toggleMute').textContent = '🔊';

    showUI();
  };

  $('toggleMute').onclick = () => {
    video.muted = !video.muted;

    $('toggleMute').textContent =
      video.muted ? '🔇' : '🔊';

    showUI();
  };

  /* ==========================================
     PLAY / PAUSE
     ========================================== */

  const playSvg = `
    <svg
      class="control-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m8 5 12 7-12 7z"/>
    </svg>
  `;

  const pauseSvg = `
    <svg
      class="control-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <rect
        x="6"
        y="4"
        width="4"
        height="16"
        rx="1"
      />
      <rect
        x="14"
        y="4"
        width="4"
        height="16"
        rx="1"
      />
    </svg>
  `;

  const syncPlaybackIcon = () => {
    const paused = video.paused || video.ended;

    const button = $('togglePlayback');

    button.innerHTML = paused
      ? playSvg
      : pauseSvg;

    button.title = paused
      ? 'Reproduzir (pausado)'
      : 'Pausar (reproduzindo)';

    button.setAttribute(
      'aria-label',
      button.title
    );

    button.setAttribute(
      'aria-pressed',
      String(!paused)
    );
  };

  [
    'play',
    'playing',
    'pause',
    'ended',
    'emptied',
    'loadedmetadata'
  ].forEach(event => {
    video.addEventListener(
      event,
      syncPlaybackIcon
    );
  });

  syncPlaybackIcon();

  $('togglePlayback').onclick = async () => {
    if (video.paused) {
      try {
        await video.play();
      } catch (error) {
        console.warn(
          'Não foi possível reproduzir:',
          error
        );
      }
    } else {
      video.pause();
    }

    syncPlaybackIcon();
    showUI();
  };

  /* ==========================================
     CANAL ANTERIOR / PRÓXIMO
     ========================================== */

  const switchChannel = delta => {
    const channels = getChannels();

    if (!channels.length) return;

    const currentName = normalizeChannelName(
      getCurrentChannelName()
    );

    let index = channels.findIndex(channel => {
      return normalizeChannelName(
        channel.name
      ) === currentName;
    });

    if (index < 0) {
      index = channels.findIndex(channel => {
        return String(channel.id) ===
          String(appState().selected);
      });
    }

    const next = channels[
      (index + delta + channels.length) %
      channels.length
    ];

    if (!next) return;

    history.replaceState(
      null,
      '',
      `#${encodeURIComponent(next.id)}`
    );

    selectChannel(next.id);

    scheduleChannelScroll(true);

    showUI();
  };

  $('previousChannel').onclick = () => {
    switchChannel(-1);
  };

  $('nextChannel').onclick = () => {
    switchChannel(1);
  };

  /* ==========================================
     TELA CHEIA
     ========================================== */

  $('toggleFullscreen').onclick = async () => {
    const wrapper = document.querySelector(
      '.video-wrap'
    );

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (wrapper?.requestFullscreen) {
        await wrapper.requestFullscreen();
      } else if (video.requestFullscreen) {
        await video.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    } catch (error) {
      if (video.webkitEnterFullscreen) {
        try {
          video.webkitEnterFullscreen();
        } catch (fallbackError) {
          console.warn(
            'Tela cheia indisponível:',
            fallbackError
          );
        }
      } else {
        console.warn(
          'Tela cheia indisponível:',
          error
        );
      }
    }

    showUI();
  };

  /* ==========================================
     PICTURE-IN-PICTURE
     ========================================== */

  $('togglePip').onclick = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (
        document.pictureInPictureEnabled &&
        video.readyState > 0
      ) {
        await video.requestPictureInPicture();
      }
    } catch (error) {
      console.warn(
        'Picture-in-Picture indisponível:',
        error
      );
    }

    showUI();
  };

  /* ==========================================
     MULTITELAS
     ========================================== */

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
    if (multi) {
      return closeMulti();
    }

    multi = true;
    choosingSecond = true;

    $('multiView').hidden = false;

    page.classList.add('multi-active');

    $('toggleMulti').classList.add('active');

    setPanel(true);
    showUI();
  };

  $('closeSecond').onclick = closeMulti;

  $('chooseSecond').onclick = () => {
    choosingSecond = true;
    setPanel(true);
  };

  const loadSecond = channel => {
    const source = (channel.sources || [])[0];

    if (!source) {
      $('secondEmpty')
        .querySelector('p')
        .textContent =
          'Este canal não possui fonte disponível.';

      return;
    }

    clearSecond();

    secondId = channel.id;

    const url = buildStreamUrl(source);

    $('secondEmpty').style.display = 'none';

    secondVideo.style.display = 'block';

    if (window.Hls && Hls.isSupported()) {
      secondHls = new Hls({
        enableWorker: true
      });

      secondHls.loadSource(url);

      secondHls.attachMedia(secondVideo);

      secondHls.on(
        Hls.Events.MANIFEST_PARSED,
        () => {
          secondVideo.play().catch(() => {});
        }
      );

      secondHls.on(
        Hls.Events.ERROR,
        (_event, error) => {
          if (error.fatal) {
            $('secondEmpty').style.display = 'block';

            $('secondEmpty')
              .querySelector('p')
              .textContent =
                'Falha na reprodução da segunda tela.';
          }
        }
      );
    } else if (
      secondVideo.canPlayType(
        'application/vnd.apple.mpegurl'
      )
    ) {
      secondVideo.src = url;

      secondVideo.play().catch(() => {});
    } else {
      $('secondEmpty').style.display = 'block';

      $('secondEmpty')
        .querySelector('p')
        .textContent =
          'Navegador sem suporte a HLS.';
    }

    choosingSecond = false;

    setPanel(false);
  };

  // Captura a seleção quando o usuário
  // estiver escolhendo o segundo canal.
  channelList.addEventListener(
    'click',
    event => {
      if (
        !multi ||
        !choosingSecond ||
        event.target.closest('[data-fav]')
      ) {
        return;
      }

      const item = event.target.closest(
        '.channel-item'
      );

      if (!item) return;

      const channel = getChannels().find(c => {
        return String(c.id) ===
          String(item.dataset.id);
      });

      if (!channel) return;

      event.stopImmediatePropagation();

      loadSecond(channel);
    },
    true
  );

  /* ==========================================
     NOME DO CANAL ATUAL
     ========================================== */

  const updateCurrent = () => {
    const name = $('playingName')?.textContent?.trim();

    $('liveCurrentName').textContent =
      name || 'Ao vivo';
  };

  if (playingName) {
    new MutationObserver(updateCurrent).observe(
      playingName,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );
  }

  updateCurrent();

  /* ==========================================
     EVENTOS DA INTERFACE
     ========================================== */

  $('ao-vivo').addEventListener(
    'mousemove',
    showUI,
    { passive: true }
  );

  $('ao-vivo').addEventListener(
    'pointerdown',
    showUI,
    { passive: true }
  );

  $('ao-vivo').addEventListener(
    'touchstart',
    showUI,
    { passive: true }
  );

  document.addEventListener(
    'keydown',
    event => {
      if (event.key === 'Escape') {
        currentSchedule(false);

        closeFullGuide();

        if (multi) {
          closeMulti();
        }
      }

      showUI();
    }
  );

  /* ==========================================
     INICIALIZAÇÃO
     ========================================== */

  setPanel(true);

  showUI();

  scheduleChannelScroll(false);

})();
