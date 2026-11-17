
const BASE_URL = 'https://filmes-saimo.pages.dev';
// Converte identificadores compactos do catálogo em URLs reproduzíveis.
function expandSources(raw,kind){
 const base=kind==='series'?'https://nixplay.lat/series/saimo-vods/221097/':'https://nixplay.lat/movie/saimo-vods/221097/';
 const parts=String(raw||'').split(',').map(s=>s.trim());
 const primary=[],secondary=[];
 for(const part of parts){
  const m=part.match(kind==='series'?/^19:(\d+\/\d+\/\d+)(?:\.mp4(?:\?[^,]*)?)?$/:/^18:(\d+)(?:\.mp4(?:\?[^,]*)?)?$/);
  if(m)primary.push(base+m[1]);
  else if(/^https?:\/\//i.test(part))secondary.push(part);
 }
 return [...new Set([...primary,...secondary])];
}


export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const letter = String(url.searchParams.get('letter') || '').toUpperCase();

  if (!/^(?:[A-Z]|#)$/.test(letter)) {
    return Response.json(
      { error: 'Inicial inválida' },
      { status: 400 }
    );
  }

  try {
    const file = letter === '#' ? '%23' : letter;
    const sourceUrl = `${BASE_URL}/filmes-${file}.txt`;

    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Fonte HTTP ${response.status}`);
    }

    const lines = (await response.text()).split(/\r?\n/);
    const result = [];

    for (const line of lines) {
      const [title, ...fields] = line.split('\t');

      if (!title?.trim()) continue;

      const entry = {
        title: title.trim(),
        dub: [],
        leg: []
      };

      for (const field of fields) {
        const match = field.match(/^\s*(dub|leg)=(.*)$/i);

        if (!match) continue;

        entry[match[1].toLowerCase()] = expandSources(match[2], 'movie');
      }

      result.push(entry);
    }

    return Response.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=300'
      }
    });

  } catch (error) {
    console.error('[MOVIE SOURCES]', error);

    return Response.json(
      { error: 'Falha ao consultar fontes de filmes' },
      { status: 502 }
    );
  }
}
