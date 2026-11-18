
export async function onRequest(context) {
  const { request, env } = context;

  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Método não permitido', { status: 405 });
  }

  if (!env.WARP_PROXY_URL || !env.WARP_PROXY_TOKEN) {
    return new Response('Proxy não configurado', { status: 503 });
  }

  const incoming = new URL(request.url);
  const target = incoming.searchParams.get('url');

  if (!target) {
    return new Response('Parâmetro url obrigatório', { status: 400 });
  }

  try {
    const parsed = new URL(target);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new Response('URL inválida', { status: 400 });
    }
  } catch {
    return new Response('URL inválida', { status: 400 });
  }

  const upstreamUrl = new URL(env.WARP_PROXY_URL);
  upstreamUrl.searchParams.set('url', target);

  const headers = new Headers({
    'X-Proxy-Token': env.WARP_PROXY_TOKEN
  });

  for (const name of ['range', 'if-range']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const response = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers,
      redirect: 'manual'
    });

    const outputHeaders = new Headers();

    for (const name of [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'content-encoding',
      'etag',
      'last-modified',
      'cache-control'
    ]) {
      const value = response.headers.get(name);
      if (value !== null) outputHeaders.set(name, value);
    }

    outputHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(
      request.method === 'HEAD' ? null : response.body,
      {
        status: response.status,
        headers: outputHeaders
      }
    );
  } catch (error) {
    console.error('Proxy2:', error.message);

    return new Response('Erro de comunicação com a Azure', {
      status: 502
    });
  }
}
