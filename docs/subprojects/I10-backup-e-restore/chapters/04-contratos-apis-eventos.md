# I10 — 04 | Contratos, APIs e eventos

**Contratos internos observados:** `safe_database`, `run`, `Postgres`, `verified_archive`, `restore_drill` e `main` descritos em [Referência técnica](../REFERENCIA-TECNICA.md). Não são exports públicos versionados.

O script consulta `control_events.outbox_events`, `platform_events.outbox_events`, `platform_events.event_deliveries` e `platform_events.consumer_inbox` para comparar fatos sintéticos. Esses objetos pertencem aos schemas de origem; não se infere propriedade, publicação de evento ou endpoint HTTP de I10.

**Witness registry:** nenhuma entrada adicionada: não houve extração AST independente nem comprovação de contrato público. Testes e integração permanecem não verificados.


## Matriz de contratos estáticos (fonte revalidada)

Fonte: [`scripts/events/disposable_restore_drill.py`](https://github.com/delmacy/syndes-system/blob/fa10ac79ce5e229d2f292b5358ff421400281e68/scripts/events/disposable_restore_drill.py), consultada no `main` `fa10ac79ce5e229d2f292b5358ff421400281e68`, blob `f381ffe9948cfc63c8bb19fef9a78f3c2d9743f4`. Este registro atualiza a referência de leitura, sem reivindicar execução.

| Elemento | Tipo | Contrato/limite observado |
|---|---|---|
| `safe_database(name: str) -> str` | função privada do ensaio | Aceita somente nomes compatíveis com `SAFE_DB`; caso contrário lança `DrillError` |
| `run(argv, stdin=None, timeout=90, allowed_failure=False)` | wrapper local de subprocesso | Executa processo com saída capturada e timeout; não é API HTTP |
| `Postgres` | classe interna | Constrói operações de PostgreSQL no contêiner descartável; identidade deve começar com `syndes-events-restore-drill-` |
| `CONTROL` e `TENANT` | listas de fixtures/schema | Apontam para schemas e migrations de outros owners, não criam migrations próprias de I10 |
| `CONTROL_FACTS` e `TENANT_FACTS` | consultas SQL somente de leitura do ensaio | Conferem contagens, eventos, integridade e entregas dos dados sintéticos |
| `IMAGE` | configuração de ensaio | `postgres:17-alpine`; não é declaração de imagem operacional de produção |

**Fronteira:** a existência de chamadas Docker, `pg_dump`, `pg_restore` e consultas no script não prova backup de produção, restore homologado, RPO/RTO, exposição de API ou integração implantada. Nenhuma migração foi aplicada nesta auditoria.

**Testemunhas:** esta matriz é uma leitura manual de fonte com SHA; não adiciona entrada ao registry de AST nem atesta execução.
