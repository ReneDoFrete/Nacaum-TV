# Naçaum TV — On Demand v2

Esta versão mantém a TV ao vivo e substitui a página `public/movies.html` por uma interface responsiva com categorias, catálogo, perfis TMDB, temporadas e episódios e player em tela inteira com controles customizados.

## Testar no Windows (CMD)

```cmd
set "TMDB_API_KEY=SUA_CHAVE_NOVA"
npm install
npm start
```

Acesse `http://localhost:3000/movies.html`.

## Cloudflare Pages

Configure `TMDB_API_KEY` em Settings > Variables and Secrets. Faça novo deploy com a pasta `public` como diretório de saída e mantenha `functions/api/ondemand.js` na raiz do projeto.

## Fontes do catálogo

- Filmes: `filmes-A.txt` a `filmes-Z.txt` e `filmes-%23.txt`.
- Séries: `series-A.txt` a `series-Z.txt`.
- Episódios: `series-A-2.txt` a `series-Z-2.txt`, consultados por título e letra ao abrir a série.
- Animes/doramas: `redeflix/links-animes.txt` e `redeflix/links-doramas.txt`.

Os formatos dos arquivos de anime/dorama podem variar; o parser genérico funciona para entradas tabuladas com URLs e pode precisar de ajustes caso o arquivo seja um índice em outro formato. Não há promessa de reprodução de todas as fontes: URLs remotas devem ser compatíveis com o navegador e autorizadas para o domínio. O projeto não modifica controles de autenticação nem DRM.

## Limitações

O catálogo é carregado por letra para não buscar dezenas de milhares de títulos em uma única requisição. A busca é local à letra/categoria selecionada. A seção "Em alta" usa uma amostra do catálogo e não é um ranking real de audiência. A interface foi implementada e passou na verificação sintática; as URLs de streaming não foram verificadas individualmente.
