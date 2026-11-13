/* Interações do player On Demand — sem alterar o carregamento das fontes. */
(() => {
  const cinema = document.getElementById('cinema');
  const video = document.getElementById('movieVideo');
  if (!cinema || !video) return;
  const TIMEOUT = 3000;
  let idleTimer = null, lastTap = null, feedbackTimer = null;
  const isOpen = () => !cinema.hidden;
  const reveal = () => {
    if (!isOpen()) return;
    cinema.classList.remove('controls-hidden');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (isOpen()) cinema.classList.add('controls-hidden');
    }, TIMEOUT);
  };
  const stop = () => { clearTimeout(idleTimer); cinema.classList.remove('controls-hidden'); };
  const center = document.createElement('button');
  center.type = 'button'; center.className = 'cinema-center-play';
  center.setAttribute('aria-label', 'Pausar ou continuar'); center.title = 'Pausar ou continuar (K)';
  cinema.appendChild(center);
  const feedback = document.createElement('div');
  feedback.className = 'cinema-skip-feedback'; feedback.setAttribute('aria-live', 'polite');
  cinema.appendChild(feedback);
  const icon = (name) => {
    center.innerHTML = name === 'play'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5 20 12 7 19.5z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  };
  const toggle = () => { if (!isOpen()) return; if (video.paused) video.play().catch(() => {}); else video.pause(); reveal(); };
  const skip = (seconds) => {
    if (!isOpen() || !Number.isFinite(video.currentTime)) return;
    const duration = video.duration;
    video.currentTime = Number.isFinite(duration) && duration > 0
      ? Math.min(duration, Math.max(0, video.currentTime + seconds))
      : Math.max(0, video.currentTime + seconds);
    feedback.className = `cinema-skip-feedback ${seconds < 0 ? 'left' : 'right'} visible`;
    feedback.textContent = seconds < 0 ? '↶ 10s' : '10s ↷';
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => feedback.classList.remove('visible'), 650);
    reveal();
  };
  const zone = x => { const r = video.getBoundingClientRect(); return (x - r.left) / r.width; };
  const handleDouble = x => { const z = zone(x); if (z < .4) skip(-10); else if (z > .6) skip(10); else toggle(); };
  center.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  video.addEventListener('play', () => icon('pause'));
  video.addEventListener('pause', () => icon('play'));
  icon(video.paused ? 'play' : 'pause');
  // A versão antiga alternava controles a cada clique; o novo comportamento é somente revelar.
  video.addEventListener('click', e => { e.stopImmediatePropagation(); reveal(); }, true);
  video.addEventListener('dblclick', e => { if (!isOpen()) return; e.preventDefault(); handleDouble(e.clientX); }, true);
  video.addEventListener('pointerup', e => {
    if (!isOpen() || e.pointerType === 'mouse') return;
    const now = performance.now();
    const current = { at: now, x: e.clientX, y: e.clientY };
    if (lastTap && now - lastTap.at < 330 && Math.hypot(current.x - lastTap.x, current.y - lastTap.y) < 70) {
      e.preventDefault(); handleDouble(e.clientX); lastTap = null;
    } else lastTap = current;
    reveal();
  }, true);
  cinema.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') reveal(); }, {passive:true});
  cinema.addEventListener('pointerdown', reveal, {passive:true});
  cinema.addEventListener('keydown', reveal);
  cinema.addEventListener('focusin', reveal);
  document.addEventListener('keydown', e => {
    if (!isOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
    const active = document.activeElement;
    if (active?.matches('input,textarea,select,[contenteditable="true"]')) return;
    const key = e.key.toLowerCase();
    if (key === 'k') { e.preventDefault(); toggle(); }
    else if (key === 'j') { e.preventDefault(); skip(-10); }
    else if (key === 'l') { e.preventDefault(); skip(10); }
    else if (key === 'm') { e.preventDefault(); document.getElementById('mute')?.click(); reveal(); }
    else if (['+', '=', 'add'].includes(key) || e.code === 'NumpadAdd') { e.preventDefault(); video.volume = Math.min(1, Math.round((video.volume + .1) * 100) / 100); if (video.muted && video.volume > 0) document.getElementById('mute')?.click(); reveal(); }
    else if (['-', '_', 'subtract'].includes(key) || e.code === 'NumpadSubtract') { e.preventDefault(); video.volume = Math.max(0, Math.round((video.volume - .1) * 100) / 100); reveal(); }
  }, true);
  // Observa abertura/fechamento, inclusive quando acionados pelo código já existente.
  new MutationObserver(() => { if (isOpen()) reveal(); else stop(); }).observe(cinema, {attributes:true,attributeFilter:['hidden']});
  if (isOpen()) reveal();
})();
