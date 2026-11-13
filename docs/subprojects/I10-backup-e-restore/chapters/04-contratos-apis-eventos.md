# I10 — 04 | Contratos, APIs e eventos

**Contratos internos observados:** `safe_database`, `run`, `Postgres`, `verified_archive`, `restore_drill` e `main` descritos em [Referência técnica](../REFERENCIA-TECNICA.md). Não são exports públicos versionados.

O script consulta `control_events.outbox_events`, `platform_events.outbox_events`, `platform_events.event_deliveries` e `platform_events.consumer_inbox` para comparar fatos sintéticos. Esses objetos pertencem aos schemas de origem; não se infere propriedade, publicação de evento ou endpoint HTTP de I10.

**Witness registry:** nenhuma entrada adicionada: não houve extração AST independente nem comprovação de contrato público. Testes e integração permanecem não verificados.
