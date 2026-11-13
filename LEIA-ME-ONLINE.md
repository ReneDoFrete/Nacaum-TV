# Contador de pessoas online

O indicador aparece na barra superior, antes de Buscar, no desktop. Atualiza a cada 25 segundos e considera online quem enviou presença nos últimos 75 segundos. Uma identidade é compartilhada entre abas do mesmo navegador via localStorage. É uma estimativa de navegadores ativos, não uma contagem de pessoas físicas.

## Localhost

`npm start` já ativa `/api/online` com memória do processo Node.js. Reiniciar o servidor zera a contagem.

## Cloudflare Pages (necessário configurar UMA VEZ)

1. No painel Cloudflare, abra **Workers & Pages → D1 → Create database** e crie `nacaum-presence`.
2. No banco D1, aba **Console**, execute o conteúdo de `schema-online.sql`.
3. Abra **Workers & Pages → seu projeto Pages → Settings → Bindings → Add → D1 database**. Nome da variável/binding: **DB** (exatamente). Escolha o banco `nacaum-presence`. Faça isso para **Production** e para **Preview** se quiser testar previews.
4. Salve e **faça novo deploy** do projeto. A função `functions/api/online.js` atenderá a rota `/api/online` automaticamente.
5. Confira no navegador a resposta ao POST `/api/online` (o script envia sozinho) e o contador na barra superior.

Se o D1 não estiver vinculado, o indicador mostra `— online` em vez de inventar um número. Não use `wrangler.toml` sem configurar também os outros bindings do projeto.

Observação: o contador representa navegadores com uma aba visível recentemente; navegadores em background deixam de enviar heartbeat, e a contagem pode levar até 75 segundos para cair após a saída. O sistema não identifica pessoas nem exige login.
