/* Naçaum TV: barra de controles dentro do player em telas pequenas. */
(() => {
  const mobile = window.matchMedia('(max-width: 800px)');
  const player = document.querySelector('.player-panel');
  const wrap = document.querySelector('.video-wrap');
  const video = document.getElementById('video');
  const controls = document.getElementById('liveControls');
  const guide = document.getElementById('liveGuide');
  if (!player || !wrap || !video || !controls || !guide) return;

  const controlsHome = document.createComment('controles: posição desktop');
  const guideHome = document.createComment('programação: posição desktop');
  controls.before(controlsHome);
  guide.before(guideHome);

  function updateLayout() {
    if (mobile.matches) {
      // O fullscreen deste contêiner inclui vídeo + controles personalizados.
      wrap.append(controls);
      player.append(guide);
      video.controls = false;
      controls.setAttribute('tabindex', '0');
      controls.setAttribute('aria-label', 'Controles do player; deslize para ver mais opções');
      document.body.classList.add('live-ui-visible');
    } else {
      controlsHome.after(controls);
      guideHome.after(guide);
      video.controls = false;
      controls.removeAttribute('tabindex');
      controls.setAttribute('aria-label', 'Controles de TV');
    }
  }
  mobile.addEventListener('change', updateLayout);
  updateLayout();

  wrap.addEventListener('click', event => {
    if (!mobile.matches || event.target.closest('button,input,.live-controls')) return;
    document.body.classList.toggle('mobile-player-controls-hidden');
    document.body.classList.add('live-ui-visible');
  });
})();
