# Naçaum TV

Site de streaming feito por mim, levando o nome da minha página de memes do fluminense no instagram "Naçaum Tricolor".

## Requisitos
- Node.js 20 ou superior
- Conexão com a internet para carregar HLS.js e fontes externas (Google Fonts)

## Instalação
```bash
npm install
npm start
```
Abra `http://localhost:3000`. Para testar no celular conectado à mesma rede Wi-Fi, abra `http://IP-DO-COMPUTADOR:3000`.

## Estrutura
- `server.js`: servidor Express e API de canais
- `data/channels.json`: catálogo de canais
- `public/`: interface, estilos, player e logo
- `scripts/parse-list.mjs`: conversor simples do arquivo de canais para JSON

## Adicionar canais
Edite `data/channels.json`, seguindo este formato:
```json
[
  {
    "id": "meu-canal",
    "name": "Meu Canal",
    "category": "TV Aberta",
    "logo": "https://meusite.com/logo.png",
    "description": "Descrição opcional",
    "sources": [
      { "url": "https://meusite.com/live/playlist.m3u8", "type": "hls" }
    ]
  }
]
```
O exemplo incluído é apenas um fluxo público de demonstração. Troque-o por uma transmissão sua ou licenciada antes de colocar o site no ar.

### Importar uma lista no formato texto
```bash
node scripts/parse-list.mjs minha-lista-autorizada.txt data/channels.json
```
O conversor importa nome, categoria, logo e fontes HLS diretas em HTTPS terminadas em `.m3u8`. Ele deliberadamente não importa `referer`, `agente` nem `chave`/dados DRM, e ignora links `error.txt`. Fontes que dependem de autenticação, cabeçalhos especiais ou DRM precisam de uma integração oficial autorizada pelo provedor. Não use proxy para contornar bloqueios, autenticação ou controles de acesso.

## Publicação
Pode ser hospedado em VPS ou serviço compatível com Node.js:
1. Envie a pasta do projeto.
2. Execute `npm install`.
3. Configure `PORT` se necessário.
4. Inicie com `npm start` e mantenha o processo ativo com o gerenciador de processos do servidor.
5. Configure HTTPS e um domínio.

## Observações importantes
- O player reproduz HLS quando o servidor da transmissão permite acesso cross-origin (CORS) e o navegador suporta o formato.
- Alguns provedores bloqueiam reprodução fora do app/site oficial, exigem autenticação ou usam DRM. Este projeto não tenta contornar essas proteções.
- Disponibilize somente canais, filmes, eventos e rádios que você tenha criado ou para os quais possua autorização/licença de distribuição.
- O catálogo de filmes, séries e eventos está preparado visualmente como seção inicial; não inclui conteúdo de terceiros nem serviço de catálogo.
- Favoritos ficam salvos localmente no navegador de cada visitante.

\n## Catálogo importado nesta versão\n
O arquivo `data/channels.json` foi preenchido a partir da lista de texto fornecida nesta conversa. Foram encontrados 249 registros `canal`; 190 possuem ao menos uma fonte direta HTTPS terminada em `.m3u8`, totalizando 228 fontes importadas. Endereços `error.txt`, fontes HTTP sem TLS e metadados `Referer`/`User-Agent` não são usados pelo player web. O player tenta as fontes HLS importadas em sequência quando uma falha.

**Atenção:** uma URL aparecer no catálogo não garante que vá tocar. O servidor de origem precisa autorizar o domínio do Naçaum TV e responder com CORS adequado; algumas playlists também dependem de autenticação ou regras do provedor. Configure a integração web oficialmente com o fornecedor.
