import express from 'express';
import serverless from 'serverless-http';
import fs from 'node:fs';
import path from 'node:path';

const app = express();

app.get('/api/channels', (_req, res) => {
  try {
    const filePath = path.resolve('data/channels.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    res.type('application/json').send(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler data/channels.json' });
  }
});

function buildProxyUrl(targetUrl, referer, ua) {
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set('referer', referer);
  if (ua) params.set('ua', ua);
  return `/api/proxy?${params.toString()}`;
}

app.get('/api/proxy', async (req, res) => {
  const { url, referer, ua } = req.query;
  if (!url) return res.status(400).send('URL ausente');

  try {
    const headers = {
      'Accept': '*/*',
      'User-Agent': ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    };
    if (referer) {
      headers['Referer'] = referer;
      try { headers['Origin'] = new URL(referer).origin; } catch {}
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return res.status(response.status).send(`HTTP ${response.status}`);

    const finalUrl = response.url || url;
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    res.setHeader('Access-Control-Allow-Origin', '*');

    const isPlaylist =
      finalUrl.includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('x-mpegurl');

    if (isPlaylist) {
      const text = await response.text();
      const baseUrl = new URL(finalUrl);

      const rewritten = text
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith('#')) {
            return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
              const absUri = new URL(uri, baseUrl).href;
              return `URI="${buildProxyUrl(absUri, referer, ua)}"`;
            });
          }
          const absoluteUrl = new URL(trimmed, baseUrl).href;
          return buildProxyUrl(absoluteUrl, referer, ua);
        })
        .join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(rewritten);
    }

    res.setHeader('Content-Type', contentType || 'video/mp2t');
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(502).send('Falha ao conectar no stream');
  }
});

export const handler = serverless(app);