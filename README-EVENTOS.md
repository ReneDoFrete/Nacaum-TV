# Eventos — Naçaum TV

## Cloudflare Pages

1. No D1 já vinculado ao binding `DB`, execute `events-schema.sql` no Console SQL.
2. Configure a variável secreta `SCRAPERAPI_KEY` em Pages > Settings > Variables and Secrets.
3. Opcional: `SOFA_CHANNEL_IDS` como JSON com os IDs restantes de Premiere e SporTV. Os IDs comprovados no arquivo fornecido já estão incluídos.
4. Faça deploy. A primeira visita do dia monta o snapshot no D1. Visitas seguintes reutilizam a lista; os jogos em andamento são monitorados a cada consulta (a página atualiza a cada 60s).
5. Para atualização exatamente à meia-noite, configure um Cron Trigger em um Worker separado que chame a API às 00:00 de São Paulo. Sem cron, a primeira visita após meia-noite inicia a atualização.

## Observações

- O FotMob oferece jogos e canais de futebol; outros esportes só aparecerão se a fonte retornar eventos deles.
- O monitor do Futbol24 usa a lógica de `monitor.js` para placar e `in_play`; ele não é fonte universal para outros esportes.
- O enriquecimento do SofaScore é realizado apenas ao montar o snapshot, não durante o polling. A quantidade de requisições nesse momento depende dos jogos com SporTV/Premiere.
- A detecção de encerramento depende de correspondência dos nomes do Futbol24. Se o jogo desaparecer da API antes de ser detectado, pode permanecer com o último estado.
- Canais com nomes parecidos devem ser verificados antes de disponibilizar; não inclui nem hospeda streams.
- O ID de SporTV 4 e vários IDs Premiere 2–8 não constam na lista enviada; configure-os quando disponíveis.
- O cache de D1 é persistente entre reinícios; a API local usa arquivo JSON.
