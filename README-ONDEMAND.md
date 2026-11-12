# On Demand — Naçaum TV

Nova página `/movies.html`, inspirada no layout da referência, com busca, catálogo alfabético A–Z, pôsteres, detalhes e seleção DUB/LEG. O site existente foi preservado.

## Cloudflare Pages

1. Suba os arquivos modificados ao repositório já conectado ao Cloudflare Pages.
2. No painel do projeto, abra **Settings > Variables and Secrets** e configure `TMDB_API_KEY` com a **API Key v3** do TMDB (a chave usada no link que você enviou). Alternativamente, configure `TMDB_READ_TOKEN` com um **API Read Access Token (Bearer)**. Não coloque nenhuma das chaves no JavaScript público.
3. Faça um novo deploy.
4. Abra `/movies.html`.

A função `/functions/api/ondemand.js` lê sob demanda `https://filmes-saimo.pages.dev/filmes-A.txt` e demais letras, extrai títulos e fontes, e busca metadados no TMDB. A função possui cache. Títulos sem TMDB ID podem ser consultados pelo título quando abertos. Pôsteres de itens sem ID podem não aparecer na grade até existir correspondência.

**Limitações:** fontes `http://` não reproduzem em sites HTTPS por bloqueio de conteúdo misto; endpoints HLS/MP4 precisam permitir reprodução pelo navegador, CORS e acesso autorizado. Esta implementação não burla bloqueios nem garante reprodução de todos os filmes. O catálogo remoto pode mudar e alguns arquivos de letras podem não existir.

## Local

O servidor Express existente não possui a rota `/api/ondemand`; para testar a função Cloudflare localmente, utilize `npx wrangler pages dev public` com a configuração de variáveis apropriada. No deploy Pages, as funções são detectadas automaticamente.
