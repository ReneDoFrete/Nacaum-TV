import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
app.use(express.static('public'));

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