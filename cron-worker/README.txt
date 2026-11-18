AGENDAMENTO INDEPENDENTE DO SITE (Cloudflare Worker)

1. Na Cloudflare Pages, configure a secret EVENTS_CRON_SECRET com uma senha longa aleatoria.
2. Abra CMD dentro desta pasta cron-worker.
3. Execute: npx wrangler secret put EVENTS_CRON_SECRET (crie o Worker primeiro se solicitado).
4. Execute: npx wrangler deploy
5. Confira em Workers & Pages > nacaum-tv-events-cron > Triggers.

O cron roda a cada hora cheia UTC. A meia-noite de Brasilia corresponde
as 03:00 UTC atualmente; logo ele dispara exatamente a meia-noite.
Se perder o horario, a proxima hora tenta novamente. O endpoint e idempotente
para a mesma data, e o site tambem cria snapshot na primeira visita se necessario.

No npm start: inicializa snapshot ao subir, agenda meia-noite e revalida a cada 15 min.
OBS: O site Pages nao executa npm start; para producao, publique o Worker cron.
