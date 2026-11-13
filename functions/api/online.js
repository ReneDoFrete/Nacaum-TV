// Cloudflare Pages Functions — vincule um banco D1 como DB.
export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return Response.json({ error: 'Configure o binding D1 DB no Cloudflare Pages' }, { status: 503 });
  }
  let payload;
  try { payload = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  const id = payload?.id;
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) {
    return Response.json({ error: 'Identificador inválido' }, { status: 400 });
  }
  try {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO online_visitors (id, last_seen) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen').bind(id, now).run();
    // Limpeza eventual, sem varrer a tabela a cada heartbeat.
    if (Math.random() < 0.02) {
      await env.DB.prepare('DELETE FROM online_visitors WHERE last_seen < ?').bind(now - 3600).run();
    }
    const result = await env.DB.prepare('SELECT COUNT(*) AS total FROM online_visitors WHERE last_seen >= ?').bind(now - 75).first();
    return Response.json({ online: result?.total ?? 0 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Falha na presença:', error);
    return Response.json({ error: 'Contador indisponível' }, { status: 503 });
  }
}
