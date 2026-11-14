# FotMob via VPS (sem ScraperAPI)

O site Cloudflare Pages acessa a VPS para obter o JSON do FotMob. A VPS consulta diretamente a URL fixa `https://www.fotmob.com/api/data/tvguide?country=br&timezone=America%2FSao_Paulo`.

1. Na VPS, rode o projeto Node (`npm install && npm start`) e configure `FOTMOB_RELAY_TOKEN` com um segredo longo e aleatório. Publique o servidor em HTTPS (por exemplo, `https://api.seudominio.com`).
2. No Cloudflare Pages > Settings > Variables and Secrets, defina `FOTMOB_RELAY_URL=https://api.seudominio.com/api/fotmob` e `FOTMOB_RELAY_TOKEN` com o mesmo segredo da VPS.
3. Faça deploy da VPS e do Pages. Teste `https://seu-site.pages.dev/api/fotmob`: ele deve retornar o JSON original da API. Teste `/api/events` para os eventos processados (exige D1 configurado).

Se você testar a URL da VPS diretamente no navegador com o token ativado, receberá 401; isso é esperado. O segredo não deve ser colocado no frontend. Se o FotMob retornar 403 também na VPS, a origem recusou o acesso e a rota retornará 502.

A rota `/api/fotmob` é fixa, não recebe URLs arbitrárias e não utiliza ScraperAPI. O SofaScore continua usando a configuração existente do ScraperAPI.
