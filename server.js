import { getGuide } from './epg.js';
import { onRequestGet as ondemandHandler } from './functions/api/ondemand.js';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
// Mesma API usada pela função do Cloudflare Pages, agora também no Express local.
app.get('/api/ondemand', async (req, res) => {
  try {
    const request = new Request(`http://localhost${req.originalUrl}`);
    const response = await ondemandHandler({ request, env: { ...process.env, TMDB_API_KEY: process.env.TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb' } });
    res.status(response.status);
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.send(await response.text());
  } catch (error) {
    console.error('[ON DEMAND]', error);
    res.status(502).json({ error: 'Falha ao consultar o catálogo remoto.' });
  }
});


// Catálogo de fontes mantido pelo administrador, dividido pela inicial do filme.
// Endpoint fixo: não aceita URLs arbitrárias nem expõe um proxy aberto.
app.get('/api/movie-sources', async (req, res) => {
  const letter = String(req.query.letter || '').toUpperCase();
  if (!/^(?:[A-Z]|#)$/.test(letter)) return res.status(400).json({ error: 'Inicial inválida' });
  try {
    const file = letter === '#' ? '%23' : letter;
    const response = await fetch(`https://filmes-saimo.pages.dev/filmes-${file}.txt`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Fonte HTTP ${response.status}`);
    const lines = (await response.text()).split(/\r?\n/);
    const result = [];
    for (const line of lines) {
      const [title, ...fields] = line.split('\t');
      if (!title?.trim()) continue;
      const entry = { title: title.trim(), dub: [], leg: [] };
      for (const field of fields) {
        const match = field.match(/^\s*(dub|leg)=(.*)$/i);
        if (!match) continue;
        entry[match[1].toLowerCase()] = match[2].split(',').map(url => url.trim()).filter(url => /^https?:\/\//i.test(url));
      }
      result.push(entry);
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(result);
  } catch (error) {
    console.error('[MOVIE SOURCES]', error.message);
    res.status(502).json({ error: 'Falha ao consultar fontes de filmes' });
  }
});

// Mesmo endpoint de metadados do Cloudflare Pages no ambiente local.
app.get('/api/catalog-details', async (_req, res) => {
  try {
    const upstream = await fetch('https://filmes-saimo.pages.dev/detalhes.txt', { signal: AbortSignal.timeout(20000) });
    if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.type('text/plain; charset=utf-8').send(await upstream.text());
  } catch (error) {
    console.warn('[CATALOG DETAILS]', error.message);
    res.status(502).send('Metadados indisponíveis');
  }
});

// Contador local: uma identidade por navegador, ativa por 75s.
// Em produção, Cloudflare Pages usa D1 em functions/api/online.js.
const onlineSessions = new Map();
app.post('/api/online', express.json({ limit: '1kb' }), (req, res) => {
  const id = req.body?.id;
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) {
    return res.status(400).json({ error: 'Identificador inválido' });
  }
  const now = Date.now();
  for (const [key, lastSeen] of onlineSessions) {
    if (now - lastSeen > 75000) onlineSessions.delete(key);
  }
  onlineSessions.set(id, now);
  res.set('Cache-Control', 'no-store').json({ online: onlineSessions.size });
});

// API local de eventos: arquivo persistente no Node (em produção use D1).
import { onRequestGet as eventsHandler } from './functions/api/events.js';
const snapshotsPath=path.resolve('data/event-snapshots.json');
let snapshotStore={};try{snapshotStore=JSON.parse(fs.readFileSync(snapshotsPath,'utf8'))}catch{}
const localDb={prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return snapshotStore[args[0]]?{events:snapshotStore[args[0]]}:null},async run(){if(sql.startsWith('INSERT'))snapshotStore[args[0]]=args[1];else if(sql.startsWith('UPDATE'))snapshotStore[args[1]]=args[0];fs.writeFileSync(snapshotsPath,JSON.stringify(snapshotStore));return {success:true}}}}};
app.get('/api/events',async(req,res)=>{const response=await eventsHandler({env:{DB:localDb,SCRAPERAPI_KEY:process.env.SCRAPERAPI_KEY,SOFA_CHANNEL_IDS:process.env.SOFA_CHANNEL_IDS}});res.status(response.status).json(await response.json())});

app.use(express.static('public',{maxAge:'1h'}));
app.get('/api/guide',async(req,res)=>{try{const channels=JSON.parse(fs.readFileSync(path.resolve('public/channels.json'),'utf8'));res.json(await getGuide(channels))}catch(e){res.status(503).json({error:'Guia temporariamente indisponível'})}});


// Retorna a lista exata gerada
app.get('/api/channels', (req, res) => {
  const data = fs.readFileSync(path.resolve('data/channels.json'), 'utf-8');
  res.type('json').send(data);
});

// Proxy HLS para injetar Referer/User-Agent e evitar erro de CORS/HTTP
app.get('/api/proxy', async (req, res) => {
  const { url, referer, ua } = req.query;
  if (!url) return res.status(400).send('URL ausente');

  try {
    const headers = {};
    if (referer) headers['Referer'] = referer;
    if (ua) headers['User-Agent'] = ua;

    const response = await fetch(url, { headers });
    if (!response.ok) return res.status(response.status).send('Erro na fonte');

    const contentType = response.headers.get('content-type') || '';
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Se for playlist .m3u8, reescreve os caminhos internos para passarem pelo proxy
    if (url.includes('.m3u8') || contentType.includes('mpegurl')) {
      const text = await response.text();
      const baseUrl = new URL(url);
      const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const absoluteUrl = new URL(trimmed, baseUrl).href;
        const params = new URLSearchParams({ url: absoluteUrl });
        if (referer) params.set('referer', referer);
        if (ua) params.set('ua', ua);
        return `/api/proxy?${params.toString()}`;
      }).join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(rewritten);
    }

    // Se for segmento de vídeo (.ts / .m4s), faz o stream direto
    res.setHeader('Content-Type', contentType || 'video/mp2t');
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(502).send('Falha ao conectar no stream');
  }
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));