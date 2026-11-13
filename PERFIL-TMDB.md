# Perfis TMDB — Naçaum TV

A janela de detalhes dos filmes agora apresenta capa, fundo, sinopse, avaliação, ano, gêneros, elenco, direção, favoritos e botões de reprodução.

A API `/api/ondemand?id=1437511&type=movie` consulta `/3/movie/1437511`; `/api/ondemand?id=302750&type=tv` consulta `/3/tv/302750`. O `id` é extraído do parâmetro `id` dos links de catálogo.

No Cloudflare Pages configure `TMDB_API_KEY` como variável de ambiente em Settings > Variables and Secrets. Localmente, no CMD: `set TMDB_API_KEY=SUA_CHAVE` e `npm start`. Nunca publique a chave em JS do navegador. Se a chave já foi exposta, gere outra no TMDB.

O catálogo de séries ainda precisa ser integrado ao frontend para que as temporadas e os episódios tenham seus respectivos links de reprodução. O perfil de séries exibe as temporadas do TMDB, mas não inventa links de episódios.
