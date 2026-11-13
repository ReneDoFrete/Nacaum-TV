/* Detecta fullscreen nativo e fullscreen do contêiner, apenas no mobile. */
(() => {
  const mobile = window.matchMedia('(max-width: 800px)');
  const video = document.getElementById('video');
  const update = () => {
    const fullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement || video?.webkitDisplayingFullscreen);
    document.body.classList.toggle('nacaum-mobile-fullscreen', mobile.matches && fullscreen);
  };
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(event => document.addEventListener(event, update));
  ['webkitbeginfullscreen', 'webkitendfullscreen'].forEach(event => video?.addEventListener(event, update));
  mobile.addEventListener?.('change', update);
  update();
})();
