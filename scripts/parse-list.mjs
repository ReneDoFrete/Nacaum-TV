import fs from 'node:fs';
import path from 'node:path';

const inputPath = path.resolve('saimo canais.txt');
const outputPath = path.resolve('data/channels.json');

const raw = fs.readFileSync(inputPath, 'utf-8');
const lines = raw.split(/\r?\n/);

const channels = [];
let currentChannel = null;
let currentSource = null;

for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;

  const sepIndex = line.indexOf(':');
  if (sepIndex === -1) continue;

  const key = line.slice(0, sepIndex).trim().toLowerCase();
  const value = line.slice(sepIndex + 1).trim();

  if (key === 'canal') {
    if (currentChannel) channels.push(currentChannel);
    currentChannel = {
      name: value,
      category: 'Geral',
      logo: '',
      sources: []
    };
    currentSource = null;
  } else if (currentChannel) {
    if (key === 'categoria') {
      currentChannel.category = value;
    } else if (key === 'logo') {
      currentChannel.logo = value;
    } else if (key === 'fonte') {
      currentSource = {
        url: value,
        quality: '',
        referer: '',
        userAgent: '',
        key: ''
      };
      currentChannel.sources.push(currentSource);
    } else if (currentSource) {
      if (key === 'qualidade') currentSource.quality = value;
      if (key === 'referer') currentSource.referer = value;
      if (key === 'agente') currentSource.userAgent = value;
      if (key === 'chave') currentSource.key = value;
    }
  }
}

if (currentChannel) channels.push(currentChannel);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(channels, null, 2), 'utf-8');
console.log(`Sucesso: ${channels.length} canais convertidos para data/channels.json`);