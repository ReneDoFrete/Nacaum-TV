import { getGuide } from '../../epg.js';

// Cloudflare Pages: equivalente ao GET /api/guide do Express.
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL('/channels.json', request.url);
    const channelsResponse = await env.ASSETS.fetch(new Request(url));
    if (!channelsResponse.ok) throw new Error(`Catálogo HTTP ${channelsResponse.status}`);
    const channels = await channelsResponse.json();
    if (!Array.isArray(channels)) throw new Error('Catálogo de canais inválido');
    const guide = await getGuide(channels);
    return Response.json(guide, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (error) {
    console.error('[API GUIDE]', error);
    return Response.json({ error: 'Guia temporariamente indisponível' }, { status: 503 });
  }
}
