/* Ajuste responsivo do player: mantém os mesmos controles e eventos do desktop. */
(() => {
  const mobile = window.matchMedia('(max-width: 800px)');
  const player = document.querySelector('.player-panel');
  const controls = document.getElementById('liveControls');
  const guide = document.getElementById('liveGuide');
  const section = document.getElementById('ao-vivo');
  if (!player || !controls || !guide || !section) return;

  // Marcadores preservam as posições originais ao voltar para o desktop.
  const controlsHome = document.createComment('posição original dos controles');
  const guideHome = document.createComment('posição original da programação');
  controls.before(controlsHome);
  guide.before(guideHome);

  function updateLayout() {
    if (mobile.matches) {
      // Vídeo -> controles deslizáveis -> programação -> lista de canais.
      player.append(controls, guide);
      controls.setAttribute('tabindex', '0');
      controls.setAttribute('aria-label', 'Controles do vídeo; deslize horizontalmente para ver mais opções');
    } else {
      controlsHome.after(controls);
      guideHome.after(guide);
      controls.removeAttribute('tabindex');
      controls.setAttribute('aria-label', 'Controles de TV');
    }
  }
  mobile.addEventListener('change', updateLayout);
  updateLayout();

  // Toque no vídeo: mostra os controles sem rolar até o fim dos canais.
  document.querySelector('.video-wrap')?.addEventListener('click', () => {
    if (mobile.matches) document.body.classList.add('live-ui-visible');
  }, { passive: true });
})();
