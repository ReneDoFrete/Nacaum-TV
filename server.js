import { getGuide } from './epg.js';
import { onRequestGet as ondemandHandler } from './functions/api/ondemand.js';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

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
import { onRequestGet as eventsHandler, ensureDailySnapshot } from './functions/api/events.js';
const snapshotsPath=path.resolve('data/event-snapshots.json');
let snapshotStore={};try{snapshotStore=JSON.parse(fs.readFileSync(snapshotsPath,'utf8'))}catch{}
const localDb={prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return snapshotStore[args[0]]?{events:snapshotStore[args[0]]}:null},async run(){if(sql.startsWith('INSERT'))snapshotStore[args[0]]=args[1];else if(sql.startsWith('UPDATE'))snapshotStore[args[1]]=args[0];fs.writeFileSync(snapshotsPath,JSON.stringify(snapshotStore));return {success:true}}}}};
const eventsEnv=()=>({DB:localDb,SCRAPERAPI_KEY:process.env.SCRAPERAPI_KEY,SOFA_CHANNEL_IDS:process.env.SOFA_CHANNEL_IDS});
app.get('/api/events',async(req,res)=>{const response=await eventsHandler({env:eventsEnv()});res.status(response.status).json(await response.json())});

// SEO e miniaturas: URLs absolutas para WhatsApp e mecanismos de busca.
const seoPages = new Set(['/', '/index.html', '/live.html', '/eventos.html', '/movies.html', '/favorites.html']);
app.get('/robots.txt', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  const pages = ['/', '/live.html', '/eventos.html', '/movies.html', '/favorites.html'];
  res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + pages.map(page => `<url><loc>${origin}${page}</loc></url>`).join('\n') + '\n</urlset>');
});
app.get(['/', '/index.html', '/live.html', '/eventos.html', '/movies.html', '/favorites.html'], (req, res, next) => {
  if (!seoPages.has(req.path)) return next();
  const file = path.join(process.cwd(), 'public', req.path === '/' ? 'index.html' : req.path.slice(1));
  fs.readFile(file, 'utf8', (err, html) => {
    if (err) return next(err);
    const origin = `${req.protocol}://${req.get('host')}`;
    res.type('html').send(html.replaceAll('__SITE_ORIGIN__', origin));
  });
});

app.use(express.static('public',{maxAge:'1h'}));
app.get('/api/guide',async(req,res)=>{try{const channels=JSON.parse(fs.readFileSync(path.resolve('public/channels.json'),'utf8'));res.json(await getGuide(channels))}catch(e){res.status(503).json({error:'Guia temporariamente indisponível'})}});


// Fontes MPEG-TS locais do UFC Fight Pass: conversão para HLS no Windows.
// URLs ficam apenas no arquivo local-stream.json, ignorado pelo Git.
const localHlsDir = path.resolve('local-hls');
const localStreamConfig = path.resolve('local-stream.json');
const localProcesses = new Map();
const localErrors = new Map();
const LOCAL_STREAM_IDS = ['ufc-2', 'ufc-3'];

function readLocalStreams() {
  try {
    const config = JSON.parse(fs.readFileSync(localStreamConfig, 'utf8'));
    // Compatível com configuração antiga {url: '...'}.
    const urls = Array.isArray(config.sources) ? config.sources : [config.url, config.url2];
    return LOCAL_STREAM_IDS.map((id, i) => ({id, url: urls[i]}))
      .filter(({url}) => typeof url === 'string' && /^https?:\/\//i.test(url));
  } catch (error) {
    console.warn('[HLS LOCAL] Não foi possível ler local-stream.json:', error.message);
    return [];
  }
}

function startLocalStream({id, url}) {
  const dir = path.join(localHlsDir, id);
  fs.mkdirSync(dir, {recursive:true});
  for (const name of fs.readdirSync(dir)) {
    if (/^(live\.m3u8|segment\d+\.ts)$/.test(name)) {
      try {fs.unlinkSync(path.join(dir,name));} catch {}
    }
  }
  const args = [
    '-hide_banner','-loglevel','warning','-nostdin',
    '-reconnect','1','-reconnect_streamed','1','-reconnect_delay_max','5',
    '-i',url,
    '-map','0:v:0','-map','0:a:0?',
    '-c:v','libx264','-preset','veryfast','-tune','zerolatency',
    '-pix_fmt','yuv420p','-profile:v','main',
    '-c:a','aac','-b:a','128k','-ar','48000',
    '-f','hls','-hls_time','4','-hls_list_size','6',
    '-hls_flags','delete_segments+omit_endlist+independent_segments',
    '-hls_segment_filename',path.join(dir,'segment%d.ts'),
    path.join(dir,'live.m3u8')
  ];
  const child=spawn('ffmpeg',args,{windowsHide:true,stdio:['ignore','ignore','pipe']});
  localProcesses.set(id,child);
  child.stderr.on('data',chunk=>{
    const msg=String(chunk).trim();
    if(msg){localErrors.set(id,msg.slice(-400));console.warn(`[HLS ${id}]`,msg);}
  });
  child.on('error',error=>{
    localErrors.set(id,`Falha ao iniciar FFmpeg: ${error.message}`);
    console.error(`[HLS ${id}]`,error.message);
  });
  child.on('exit',code=>{
    if(localProcesses.get(id)===child)localProcesses.delete(id);
    if(code!==0&&code!==null)console.warn(`[HLS ${id}] FFmpeg encerrou:`,code);
  });
  console.log(`[HLS ${id}] Gerando /local-hls/${id}/live.m3u8`);
}

const configuredLocalStreams=readLocalStreams();
for(const source of configuredLocalStreams)startLocalStream(source);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{
  for(const child of localProcesses.values())child.kill();
  process.exit(0);
});
app.get('/api/local-stream-status',(_req,res)=>{
  const streams=Object.fromEntries(LOCAL_STREAM_IDS.map(id=>[id,{
    configured:configuredLocalStreams.some(s=>s.id===id),
    running:!!localProcesses.get(id),
    ready:fs.existsSync(path.join(localHlsDir,id,'live.m3u8')),
    error:localErrors.get(id)||''
  }]));
  res.set('Cache-Control','no-store').json({streams});
});
app.use('/local-hls',express.static(localHlsDir,{
  setHeaders(res,file){
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
    if(file.endsWith('.m3u8'))res.setHeader('Content-Type','application/vnd.apple.mpegurl');
    if(file.endsWith('.ts'))res.setHeader('Content-Type','video/mp2t');
  }
}));

app.get('/api/channels',(_req,res)=>{
  const channels=JSON.parse(fs.readFileSync(path.resolve('data/channels.json'),'utf8'));
  const ufc=channels.find(c=>c.id==='ufc-fight-pass-249'||c.name==='UFC Fight Pass');
  if(ufc){
    for(const {id} of configuredLocalStreams){
      ufc.sources.push({url:`/local-hls/${id}/live.m3u8`,quality:id==='ufc-2'?'Servidor 2 · TS local':'Servidor 3 · TS local'});
    }
  }
  res.type('json').send(JSON.stringify(channels));
});

// Proxy HLS para injetar Referer/User-Agent e evitar erro de CORS/HTTP
app.get(['/api/proxy', '/api/proxy2'], async (req, res) => {
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
        return `${req.path === '/api/proxy2' ? '/api/proxy2' : '/api/proxy'}?${params.toString()}`;
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

// Inicialização e virada do dia: independentes de visitas ao /eventos.
let snapshotBusy=false;
async function ensureLocalDaily(){
  if(snapshotBusy)return;
  snapshotBusy=true;
  try {const result=await ensureDailySnapshot(eventsEnv());console.log('[EVENTS LOCAL DAILY]',JSON.stringify(result));}
  catch(e){console.warn('[EVENTS LOCAL DAILY ERROR]',e.message);}
  finally{snapshotBusy=false;}
}
function scheduleMidnight(){
  const now=new Date();
  const dateParts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const [year,month,day]=dateParts.split('-').map(Number);
  // Brasil (São Paulo) usa UTC-3 atualmente. Recalcular o agendamento após cada execução.
  const target=Date.UTC(year,month-1,day+1,3,0,0);
  const delay=Math.max(1000,target-Date.now());
  setTimeout(async()=>{await ensureLocalDaily();scheduleMidnight();},delay);
}
app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
  ensureLocalDaily();
  scheduleMidnight();
  // Recupera automaticamente caso o agendamento anterior tenha falhado.
  setInterval(ensureLocalDaily,15*60*1000);
});