NAÇAUM TV — V3

Executar:
  npm install
  set "TMDB_API_KEY=SUA_CHAVE"  (Windows CMD)
  npm start
  http://localhost:3000

Mudanças:
- Início com fileiras Em alta, Séries em alta, Lançamentos, Animes e Doramas, usando os destaques enviados.
- Navegação horizontal touch/mouse e cartões de acesso A–Z.
- Busca global (ícone Buscar, atalho Ctrl+K) por canais e 51 mil fichas de filmes/séries/animes/doramas, sem depender da letra.
- Busca na página de catálogo usa índice completo das fichas, não apenas a letra selecionada.
- Dados de ficha (pôster, gênero, ID TMDB) são carregados sob demanda.
- Guia de programação: Express consulta XMLTV de open-epg e iptv-epg, mantém cache de 45 minutos e associa nomes por normalização aproximada. A correspondência não é garantida para todos os canais.
- O carregamento de imagens usa lazy loading; não baixa as fichas completas do TMDB para todos os títulos na abertura.

Limitações:
- O endpoint /api/guide foi implementado para o servidor Node/Express. Para Cloudflare Pages será necessário adaptar para uma função Pages/Worker com cache.
- A pesquisa global usa fichas para localizar conteúdo; a reprodução depende de fontes autorizadas e válidas. Alguns itens podem ter ficha mas não ter fonte reproduzível.
- O guia pode demorar na primeira consulta e depende da disponibilidade dos feeds XMLTV.
- O site não inclui mecanismos para contornar DRM ou controles de acesso dos provedores.
