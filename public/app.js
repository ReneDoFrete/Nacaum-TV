const $ = (s) => document.querySelector(s);
const state = {
  channels: [],
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
    $("#channelCount").textContent = `${state.channels.length} canal(is)`;
    renderFilters();
    renderChannels();

    // Verifica se veio algum canal direto pela URL (ex: #band ou #premiere)
    checkUrlChannel();
  } catch (error) {
    $("#channelList").innerHTML = `<div class="empty">${escapeHtml(error.message)}.</div>`;
    $("#channelCount").textContent = "Sem canais";
  }
}

function checkUrlChannel() {
  const hash = window.location.hash.replace("#", "").trim();
  if (!hash || hash === "ao-vivo" || hash === "inicio" || hash === "eventos" || hash === "favoritos" || hash === "on-demand") {
    return; // Não toca nada automaticamente se for hash de navegação padrão
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
  }
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
      <div class="channel-info"><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.category || "Outros")}</small></div>
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
  state.sourceIndex = 0;
  state.retrying = false;
  renderChannels();
  $("#playingName").textContent = channel.name;
  $("#playingCategory").textContent = channel.category || "Outros";
  renderSourceButtons(channel);
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
$("#searchToggle").addEventListener("click", () => {
  $("#channelSearch-focus")?.focus() || $("#channelSearch").focus();
  document.querySelector("#ao-vivo").scrollIntoView({ behavior: "smooth" });
});

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