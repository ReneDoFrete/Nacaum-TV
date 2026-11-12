export async function onRequest(context) {
  const urlObj = new URL(context.request.url);
  
  // Rota: /api/channels
  if (urlObj.pathname.endsWith('/channels')) {
    return context.env.ASSETS.fetch(new URL('/channels.json', urlObj.origin));
  }

  // Rota: /api/proxy
  if (urlObj.pathname.endsWith('/proxy')) {
    const targetUrl = urlObj.searchParams.get('url');
    const referer = urlObj.searchParams.get('referer');
    const ua = urlObj.searchParams.get('ua');

    if (!targetUrl) return new Response('URL ausente', { status: 400 });

    const headers = new Headers({
      'Accept': '*/*',
      'User-Agent': ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    if (referer) {
      headers.set('Referer', referer);
      try { headers.set('Origin', new URL(referer).origin); } catch {}
    }

    try {
      const response = await fetch(targetUrl, { headers, redirect: 'follow' });
      if (!response.ok) return new Response(`Erro ${response.status}`, { status: response.status });

      const finalUrl = response.url || targetUrl;
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const resHeaders = new Headers({
        'Access-Control-Allow-Origin': '*',
        'Content-Type': contentType || 'video/mp2t'
      });

      if (finalUrl.includes('.m3u8') || contentType.includes('mpegurl')) {
        const text = await response.text();
        const baseUrl = new URL(finalUrl);

        const rewritten = text.split(/\r?\n/).map(line => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith('#')) {
            return line.replace(/URI="([^"]+)"/g, (_m, uri) => {
              const abs = new URL(uri, baseUrl).href;
              const p = new URLSearchParams({ url: abs });
              if (referer) p.set('referer', referer);
              if (ua) p.set('ua', ua);
              return `URI="/api/proxy?${p.toString()}"`;
            });
          }
          const abs = new URL(trimmed, baseUrl).href;
          const p = new URLSearchParams({ url: abs });
          if (referer) p.set('referer', referer);
          if (ua) p.set('ua', ua);
          return `/api/proxy?${p.toString()}`;
        }).join('\n');

        resHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
        return new Response(rewritten, { headers: resHeaders });
      }

      // Faz stream direto do vídeo sem carregar tudo na RAM antes
      return new Response(response.body, { headers: resHeaders });
    } catch (e) {
      return new Response('Erro no proxy', { status: 502 });
    }
  }

  return new Response('Not Found', { status: 404 });
}