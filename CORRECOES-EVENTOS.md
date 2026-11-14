# Ajustes de eventos (14/11/2026)

- A comparação com Futbol24 agora considera também `name_short` e os nomes do `slug`, usando ambos os times e o dia do jogo. A pesquisa tenta mandante, os dois times, visitante e a ordem inversa.
- Jogos já encerrados não são rebaixados para agendados por ausência no `in_play`.
- A consulta aos nomes das emissoras no FotMob é repetida no máximo a cada seis horas, acrescentando canais novos sem apagar os anteriores.
- A normalização reconhece variantes de TV Globo/Rede Globo/Globo e afiliadas retornadas pela fonte.
- **Correção manual confirmada pelo administrador no snapshot local de 14/11/2026:** Japão 3–2 Brasil (Globo adicionada), Manchester United (W) 2–0 Crystal Palace (W).

**Atenção:** o arquivo `data/event-snapshots.json` é usado apenas no `npm start`. A produção usa D1, e alterações locais nesse JSON não alteram automaticamente os registros da Cloudflare. A API do FotMob pode não listar todas as emissoras que transmitiram uma partida; a inclusão manual de Globo no jogo do Brasil se baseia na informação fornecida pelo administrador.

## Publicar

```bash
git add functions/api/events.js data/event-snapshots.json CORRECOES-EVENTOS.md
git commit -m "Corrige monitoramento e canais dos eventos"
git push
```
