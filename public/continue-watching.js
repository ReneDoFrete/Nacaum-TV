
(() => {
  'use strict';

  const KEY = 'nacaum-continue';

  const norm = s => String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const esc = s => String(s ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );

  function read() {
    try {
      const data = JSON.parse(
        localStorage.getItem(KEY) || '[]'
      );
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function kind(entry) {
    if (['anime', 'dorama'].includes(entry.category)) {
      return entry.category;
    }

    return entry.type === 'movie' ? 'movie' : 'series';
  }

  function write(items) {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify(items.slice(0, 60))
      );
    } catch (error) {
      console.error('[Continue assistindo]', error);
      return;
    }

    window.dispatchEvent(
      new Event('nacaum-continue-updated')
    );
  }

  function same(a, b) {
    return norm(a.title) === norm(b.title) &&
      kind(a) === kind(b);
  }

  function save(entry) {
    if (!entry?.title) return;

    const old = read();
    const previous = old.find(x => same(x, entry));

    const result = {
      ...previous,
      ...entry,
      position: Number(entry.position) || 0,
      updatedAt: Date.now()
    };

    write([
      result,
      ...old.filter(x => !same(x, entry))
    ]);
  }

  function start(entry) {
    if (!entry?.title) return;

    const old = read();
    const previous = old.find(x => same(x, entry));

    save({
      ...previous,
      ...entry,
      position: previous?.position || 0,
      duration: previous?.duration || 0
    });
  }

  function remove(title, type) {
    write(
      read().filter(x => !(
        norm(x.title) === norm(title) &&
        x.type === type
      ))
    );
  }

  function removeEntry(entry) {
    if (!entry) return;

    write(
      read().filter(x => !same(x, entry))
    );
  }

  window.NacaumContinue = {
    read,
    save,
    start,
    remove,
    removeEntry,
    kind
  };

  function currentCategory() {
    if (document.querySelector('#homeHero')) {
      return 'home';
    }

    return window.nacaumCurrentVodCategory ||
      new URLSearchParams(location.search)
        .get('category') ||
      'home';
  }

  function filtered() {
    const category = currentCategory();

    return read().filter(entry =>
      entry.title &&
      (
        category === 'home' ||
        kind(entry) === category
      )
    );
  }

  // ==========================================
  // RENDERIZAR CONTINUE ASSISTINDO
  // ==========================================

  function render() {
    const target = document.querySelector(
      '#nacaumContinueSection'
    );

    if (!target) return;

    const items = filtered();

    target.hidden = !items.length;

    if (!items.length) {
      target.innerHTML = '';
      return;
    }

    const cards = items.map((entry, index) => {
      const poster = entry.poster_path?.startsWith('/')
        ? 'https://image.tmdb.org/t/p/w342' +
          entry.poster_path
        : '';

      const progress = entry.duration > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                entry.position / entry.duration * 100
              )
            )
          )
        : 0;

      return `
        <div
          class="nacaum-continue-item"
          data-continue-index="${index}"
        >
          <button
            type="button"
            class="nacaum-continue-card"
            aria-label="Continuar assistindo ${esc(entry.title)}"
          >
            <span class="nacaum-continue-poster">
              ${
                poster
                  ? `<img
                       loading="lazy"
                       src="${poster}"
                       alt=""
                     >`
                  : '<span>▶</span>'
              }

              <span
                class="nacaum-continue-progress"
                style="width:${progress}%"
              ></span>
            </span>

            <strong>${esc(entry.title)}</strong>

            <small>
              ${esc(
                entry.episodeLabel ||
                'Continuar reprodução'
              )}
            </small>
          </button>

          <button
            type="button"
            class="nacaum-continue-remove"
            title="Remover do Continue assistindo"
            aria-label="Remover ${esc(entry.title)} do Continue assistindo"
            data-continue-remove="${index}"
          >×</button>
        </div>
      `;
    }).join('');

    target.innerHTML = `
      <h2>Continue assistindo</h2>
      <div class="nacaum-continue-rail">
        ${cards}
      </div>
    `;

    // ========================================
    // CLIQUE NO CARD OU NO X
    // ========================================

    target.onclick = event => {
      const removeButton = event.target.closest(
        '[data-continue-remove]'
      );

      if (removeButton) {
        event.preventDefault();
        event.stopPropagation();

        const index = Number(
          removeButton.dataset.continueRemove
        );

        const item = filtered()[index];

        if (item) {
          removeEntry(item);
        }

        return;
      }

      const card = event.target.closest(
        '.nacaum-continue-card'
      );

      if (!card) return;

      const wrapper = card.closest(
        '[data-continue-index]'
      );

      if (!wrapper) return;

      const item = filtered()[
        Number(wrapper.dataset.continueIndex)
      ];

      if (!item) return;

      if (window.nacaumResume) {
        Promise.resolve(
          window.nacaumResume(item)
        ).catch(console.error);
      } else {
        location.href =
          '/movies.html?category=' +
          encodeURIComponent(kind(item)) +
          '&title=' +
          encodeURIComponent(item.title) +
          '&resume=1';
      }
    };

    // ========================================
    // HOVER: PRÉVIA TMDB
    // ========================================

    target.onpointerover = event => {
      const card = event.target.closest(
        '.nacaum-continue-card'
      );

      if (!card || card.contains(event.relatedTarget)) {
        return;
      }

      const wrapper = card.closest(
        '[data-continue-index]'
      );

      if (!wrapper) return;

      const item = filtered()[
        Number(wrapper.dataset.continueIndex)
      ];

      if (item) {
        window.nacaumPreviewTitle?.(item);
      }
    };

    target.onfocusin = event => {
      const card = event.target.closest(
        '.nacaum-continue-card'
      );

      if (!card) return;

      const wrapper = card.closest(
        '[data-continue-index]'
      );

      if (!wrapper) return;

      const item = filtered()[
        Number(wrapper.dataset.continueIndex)
      ];

      if (item) {
        window.nacaumPreviewTitle?.(item);
      }
    };
  }

  // ==========================================
  // MONTAR A SEÇÃO
  // ==========================================

  function mount() {
    if (!document.querySelector('#movieVideo')) {
      return;
    }

    let target = document.querySelector(
      '#nacaumContinueSection'
    );

    if (!target) {
      target = document.createElement('section');

      target.id = 'nacaumContinueSection';
      target.className = 'nacaum-continue-section';

      const anchor =
        document.querySelector('#discoverHome') ||
        document.querySelector('#catalogSection');

      if (anchor) {
        anchor.before(target);
      }
    }

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  window.addEventListener(
    'nacaum-continue-updated',
    render
  );

  window.addEventListener('popstate', render);

  window.nacaumRenderContinue = render;

})();
