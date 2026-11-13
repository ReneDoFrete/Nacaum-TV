/* Controles e programação dentro da superfície fullscreen do player. */
(() => {
  const mobile = window.matchMedia('(max-width: 800px)');
  const player = document.querySelector('.player-panel');
  const wrap = document.querySelector('.video-wrap');
  const video = document.getElementById('video');
  const controls = document.getElementById('liveControls');
  const guide = document.getElementById('liveGuide');
  const fullGuide = document.getElementById('fullGuide');
  if (!player || !wrap || !video || !controls || !guide || !fullGuide) return;

  const homes = new Map();
  for (const element of [controls, guide, fullGuide]) {
    const anchor = document.createComment('posição original: ' + element.id);
    element.before(anchor);
    homes.set(element, anchor);
  }
  function moveToPlayer() {
    for (const element of [controls, guide, fullGuide]) wrap.append(element);
  }
  function restore() {
    for (const [element, anchor] of homes) anchor.after(element);
  }
  function updateLayout() {
    if (mobile.matches || document.fullscreenElement === wrap) {
      moveToPlayer();
      video.controls = false;
      controls.setAttribute('tabindex', '0');
      controls.setAttribute('aria-label', 'Controles do player; deslize para ver mais opções');
      document.body.classList.add('live-ui-visible');
    } else {
      restore();
      video.controls = false;
      controls.removeAttribute('tabindex');
      controls.setAttribute('aria-label', 'Controles de TV');
    }
  }
  mobile.addEventListener('change', updateLayout);
  document.addEventListener('fullscreenchange', updateLayout);
  updateLayout();

  wrap.addEventListener('click', event => {
    if (!mobile.matches || event.target.closest('button,input,.live-controls,.guide-panel,.full-guide')) return;
    document.body.classList.toggle('mobile-player-controls-hidden');
    document.body.classList.add('live-ui-visible');
  });
})();
