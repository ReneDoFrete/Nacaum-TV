const $ = (s) => document.querySelector(s);
const state = {
  channels: [],
  guide: {},
  selected: null,
  category: "Todos",
  favorites: new Set(JSON.parse(localStorage.getItem("nacaum-favs") || "[]")),
  hls: null,
  sourceIndex: 0,
  retrying: false,
  videoCheckTimer: null
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function buildStreamUrl(source) {
  const params = new URLSearchParams({ url: source.url });
  if (source.referer) params.set("referer", source.referer);
  if (source.userAgent) params.set("ua", source.userAgent);
  return `/api/proxy?${params.toString()}`;
}

async function loadChannels() {
  try {
    const response = await fetch("/api/channels");
    if (!response.ok) throw new Error("Falha ao carregar canais");
    state.channels = await response.json();
    fetch('/api/guide').then(r=>r.ok?r.json():{}).then(g=>{state.guide=g;renderChannels();if(state.selected){const c=state.channels.find(x=>x.id===state.selected);if(c)updateProgramGuide(c)}document.dispatchEvent(new Event('nacaum-guide-updated'))}).catch(()=>{});
    $("#channelCount").textContent = `${state.channels.length} canal(is)`;
    renderFilters();
    renderChannels();

    // Verifica se veio algum canal direto pela URL (ex: #band ou #premiere)
    if (!checkUrlChannel()) {
      const last = localStorage.getItem("nacaum-last-channel");
      const initial = state.channels.find(c => c.id === last) || state.channels[0];
      if (initial) selectChannel(initial.id);
    }
  } catch (error) {
    $("#channelList").innerHTML = `<div class="empty">${escapeHtml(error.message)}.</div>`;
    $("#channelCount").textContent = "Sem canais";
  }
}

function checkUrlChannel() {
  const hash = window.location.hash.replace("#", "").trim();
  if (!hash || hash === "ao-vivo" || hash === "inicio" || hash === "eventos" || hash === "favoritos" || hash === "on-demand") {
    return false;
  }

  // Tenta achar o canal pelo ID exato ou por correspondência no nome/slug
  const target = hash.toLowerCase();
  const found = state.channels.find(c => 
    c.id.toLowerCase() === target || 
    c.name.toLowerCase().includes(target) ||
    c.id.toLowerCase().includes(target)
  );

  if (found) {
    selectChannel(found.id);
    // Dá um scroll automático até a seção ao vivo para comodidade
    setTimeout(() => {
      document.querySelector("#ao-vivo")?.scrollIntoView({ behavior: "smooth" });
    }, 200);
    return true;
  }
  return false;
}

function renderFilters() {
  const cats = ["Todos", "Favoritos", ...new Set(state.channels.map((c) => c.category || "Outros"))];
  $("#categoryFilters").innerHTML = cats
    .map((c) => `<button class="filter ${c === state.category ? "active" : ""}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
    .join("");
  $("#categoryFilters").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      state.category = b.dataset.category;
      renderFilters();
      renderChannels();
    })
  );
}

function renderChannels() {
  const term = $("#channelSearch").value.trim().toLocaleLowerCase("pt-BR");
  const list = state.channels.filter((c) => {
    const matchesCat =
      state.category === "Todos" ||
      (state.category === "Favoritos" && state.favorites.has(c.id)) ||
      (c.category || "Outros") === state.category;
    const matchesTerm = `${c.name} ${c.category || ""}`.toLocaleLowerCase("pt-BR").includes(term);
    return matchesCat && matchesTerm;
  });

  $("#visibleCount").textContent = list.length;
  $("#channelList").innerHTML = list.length
    ? list
        .map(
          (c) => `
    <div class="channel-item ${state.selected === c.id ? "selected" : ""}" data-id="${escapeHtml(c.id)}">
      <div class="channel-logo">${c.logo ? `<img src="${escapeHtml(c.logo)}" alt="" loading="lazy" onerror="this.remove()">` : "NTV"}</div>
      <div class="channel-info"><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(state.guide[c.id]?.title || c.category || "Outros")}</small></div>
      <button class="fav ${state.favorites.has(c.id) ? "on" : ""}" data-fav="${escapeHtml(c.id)}" aria-label="Favoritar">${state.favorites.has(c.id) ? "♥" : "♡"}</button>
    </div>`
        )
        .join("")
    : '<div class="empty">Nenhum canal encontrado.</div>';

  $("#channelList").querySelectorAll(".channel-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (e.target.closest("[data-fav]")) return;
      const id = item.dataset.id;
      history.replaceState(null, '', `#${id}`);
      selectChannel(id);
    });
  });

  $("#channelList").querySelectorAll("[data-fav]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.fav;
      state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
      localStorage.setItem("nacaum-favs", JSON.stringify([...state.favorites]));
      renderChannels();
    })
  );
}

function selectChannel(id) {
  const channel = state.channels.find((c) => c.id === id);
  if (!channel) return;
  state.selected = id;
  localStorage.setItem("nacaum-last-channel", id);
  state.sourceIndex = 0;
  state.retrying = false;
  renderChannels();
  $("#playingName").textContent = channel.name;
  $("#playingCategory").textContent = state.guide[channel.id]?.title || "Programação indisponível";
  renderSourceButtons(channel);
  updateProgramGuide(channel);
  playCurrentSource(channel);
}

function renderSourceButtons(channel) {
  const bar = $("#sourceSelectorBar");
  const container = $("#sourceButtons");
  const sources = channel.sources || [];

  if (sources.length <= 1) {
    bar.style.display = "none";
    return;
  }

  bar.style.display = "flex";
  container.innerHTML = sources.map((s, idx) => {
    const label = s.quality || `Servidor ${idx + 1}`;
    const isActive = idx === state.sourceIndex;
    return `<button class="source-btn ${isActive ? "active" : ""}" data-index="${idx}" style="padding: 4px 10px; font-size: 12px; border-radius: 4px; border: 1px solid ${isActive ? '#22c55e' : '#334155'}; background: ${isActive ? '#166534' : '#1e293b'}; color: #fff; cursor: pointer;">${escapeHtml(label)}</button>`;
  }).join("");

  container.querySelectorAll(".source-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.sourceIndex = Number(btn.dataset.index);
      state.retrying = false;
      renderSourceButtons(channel);
      playCurrentSource(channel);
    });
  });
}

function clearTimers() {
  if (state.videoCheckTimer) {
    clearTimeout(state.videoCheckTimer);
    state.videoCheckTimer = null;
  }
}

function playCurrentSource(channel) {
  const video = $("#video");
  const placeholder = $("#playerPlaceholder");
  const message = $("#playerMessage");
  const sources = channel.sources || [];

  clearTimers();
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }
  video.pause();
  video.removeAttribute("src");
  video.load();

  if (!sources.length) {
    placeholder.style.display = "flex";
    message.textContent = "Este canal não possui fontes cadastradas.";
    return;
  }

  const source = sources[state.sourceIndex];
  const label = source.quality || `Servidor ${state.sourceIndex + 1}`;
  const proxiedUrl = buildStreamUrl(source);

  placeholder.style.display = "none";
  document.getElementById("externalFallback")?.remove();
  message.textContent = `Conectando ao ${label} (${state.sourceIndex + 1}/${sources.length})…`;

  const tryNextSource = (reason) => {
    if (state.retrying || state.selected !== channel.id) return;
    state.retrying = true;
    clearTimers();

    if (state.sourceIndex + 1 < sources.length) {
      state.sourceIndex++;
      renderSourceButtons(channel);
      message.textContent = `${reason} Alternando para o próximo servidor...`;
      setTimeout(() => {
        state.retrying = false;
        playCurrentSource(channel);
      }, 300);
    } else {
      placeholder.style.display = "flex";
      message.textContent = `Todas as fontes falharam (${reason}). Selecione outro servidor manualmente abaixo.`;
      state.retrying = false;
      showExternalFallback(channel, reason);
    }
  };

  const startVideoValidation = () => {
    clearTimers();
    state.videoCheckTimer = setTimeout(() => {
      if (state.selected !== channel.id) return;
      if (video.readyState >= 2 && (video.videoWidth === 0 || video.videoHeight === 0)) {
        tryNextSource("Codec H.265 (sem vídeo).");
      }
    }, 4000);
  };

  if (window.Hls && Hls.isSupported()) {
    state.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      manifestLoadingTimeOut: 8000,
      fragLoadingTimeOut: 8000
    });

    state.hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      const levels = data.levels || [];
      if (levels.length > 0 && levels.every((l) => l.videoCodec && /^(hvc1|hev1)/i.test(l.videoCodec))) {
        tryNextSource("H.265 detectado.");
        return;
      }

      video.play().then(() => {
        message.textContent = `Ao vivo • ${label} (${state.sourceIndex + 1}/${sources.length})`;
      }).catch(() => {
        message.textContent = `${label}: clique em play para iniciar.`;
      });
      startVideoValidation();
    });

    state.hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        tryNextSource("Erro no stream HLS.");
      }
    });

    state.hls.loadSource(proxiedUrl);
    state.hls.attachMedia(video);
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = proxiedUrl;
    video.play().catch(() => {});
    startVideoValidation();
    video.onerror = () => tryNextSource("Erro nativo.");
  } else {
    message.textContent = "Navegador sem suporte a HLS.";
    placeholder.style.display = "flex";
  }
}

$("#channelSearch").addEventListener("input", renderChannels);

function updateClock() {
  $("#clock").textContent = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

$("#year").textContent = new Date().getFullYear();
updateClock();
setInterval(updateClock, 30000);
loadChannels();
function showExternalFallback(channel, reason) {
  const wrap = document.querySelector('.video-wrap');
  document.getElementById('externalFallback')?.remove();
  const url = (channel.sources || [])[state.sourceIndex]?.url;
  const box = document.createElement('div');
  box.id = 'externalFallback';
  box.className = 'external-fallback';
  const title = document.createElement('h2'); title.textContent = 'Não foi possível reproduzir este canal aqui';
  const info = document.createElement('p'); info.textContent = `Todas as fontes falharam (${reason}). Você pode tentar abrir a fonte diretamente em outra guia, caso o provedor permita.`;
  box.append(title, info);
  if (url && /^https?:\/\//i.test(url)) {
    const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.className = 'external-open'; link.textContent = '↗ Abrir em outra página'; box.append(link);
  }
  wrap.append(box);
}

function updateProgramGuide(channel){
 const root=document.getElementById('programGuide');if(!root)return;
 const data=state.guide[channel.id];
 if(!data){root.textContent='Programação não disponível para este canal.';return}
 root.replaceChildren();
 const now=Date.now();
 const programs=Array.isArray(data.schedule)&&data.schedule.length?data.schedule:[data];
 const relevant=programs.filter(p=>p.end>now).slice(0,12);
 for(const item of relevant){
  const row=document.createElement('div');row.className='guide-row';
  if(item.start<=now&&item.end>now)row.classList.add('guide-now');
  const time=document.createElement('time');time.textContent=item.start&&item.end?`${new Date(item.start).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} – ${new Date(item.end).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`:'AGORA';
  const label=document.createElement('strong');label.textContent=item.title||'Programa sem título';
  row.append(time,label);root.append(row);
 }
 if(!relevant.length)root.textContent='Sem próximos programas disponíveis.';
 if(data.description){const p=document.createElement('p');p.textContent=data.description;root.append(p)}
}
