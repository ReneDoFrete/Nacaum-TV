// Contador de visitantes simultâneos (presença nos últimos 75 segundos).
(() => {
  const badge = document.querySelector('#onlineVisitors');
  if (!badge) return;
  const count = badge.querySelector('[data-online-count]');
  const storageKey = 'nacaum-presence-id';
  let id;
  try {
    id = localStorage.getItem(storageKey);
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(storageKey, id);
    }
  } catch {
    id = crypto.randomUUID();
  }
  let busy = false;
  async function heartbeat() {
    if (document.visibilityState === 'hidden' || busy) return;
    busy = true;
    try {
      const response = await fetch('/api/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Number.isInteger(data.online)) throw new Error('Contagem inválida');
      count.textContent = new Intl.NumberFormat('pt-BR').format(data.online);
      badge.title = `${data.online} visitante(s) ativo(s) nos últimos 75 segundos`;
      badge.classList.remove('unavailable');
    } catch {
      count.textContent = '—';
      badge.title = 'Contagem indisponível';
      badge.classList.add('unavailable');
    } finally { busy = false; }
  }
  heartbeat();
  setInterval(heartbeat, 25000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') heartbeat();
  });
})();
