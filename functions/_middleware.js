// Metadados com URL absoluta do domínio usado pelo visitante.
const pages = new Set(['/', '/index.html', '/live.html', '/eventos.html', '/movies.html', '/favorites.html']);
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname === '/robots.txt') {
    return new Response(`User-agent: *\nAllow: /\nSitemap: ${url.origin}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  if (url.pathname === '/sitemap.xml') {
    const paths = ['/', '/live.html', '/eventos.html', '/movies.html', '/favorites.html'];
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + paths.map(p => `  <url><loc>${url.origin}${p}</loc></url>`).join('\n') + '\n</urlset>';
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }
  const response = await context.next();
  if (!pages.has(url.pathname) || !response.ok || !(response.headers.get('content-type') || '').includes('text/html')) return response;
  const html = (await response.text()).replaceAll('__SITE_ORIGIN__', url.origin);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, headers });
}
