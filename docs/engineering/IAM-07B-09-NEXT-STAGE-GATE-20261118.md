# IAM-07B/09 — Matriz objetiva de desbloqueio das próximas implementações

**Data:** 2026-11-18. **Escopo:** autorizar **continuação de implementação em branch**, nunca aprovação de produção. `NEXT_IMPLEMENTATION_GATE=ELIGIBLE_ON_GREEN_CI`. `PRODUCTION_GATE=BLOCKED`.

## Por que este gate existe

A bateria IAM-03–07A já provou JWT humano, contexto Keycloak Organizations, Control+tenant PG17, SQL002, OpenFGA e revogação SSE no laboratório, mas não comprovou a segurança transacional de **todas** as operações do MVP nem o rollout/recovery operacional. Um teste verde não deve promover uma capacidade `proposed` nem liberar o IAM como autoridade de decisão no Core Host.

## Matriz automatizada executada pelo CI central

| Referência | Verificação concreta | Job / fixture | Significado e limitação |
|---|---|---|---|
| G01 — JWT | Assinatura RS256 real + JWKS local; `iss/aud/azp/sub`, exp, nbf, assinatura de chave externa, token do Manager | `Regression / host`, `iam07b-jwt-expiry-sse.test.mjs` | Negar falsificações/expiração criptograficamente. JWKS local descartável, **não** prova autenticação HTTP operacional. |
| G02 — sessão expirada | Abrir SSE com token RS256 válido, aguardar expiração real, publicar mudança, exigir `END`, zero `changed` novo; tentativa de reconexão com bearer expirado negada | `Regression / host` | Usa `InboxChangeBus` real e piloto IAM-07; não usa controller Nest/Proxy real. |
| G03 — provedor real indisponível | Para cada Keycloak member reader, link Control PG17, lease tenant PG17 e FGA HTTP, injetar **transporte para porta loopback fechada**; stream aberto fecha, nova sessão nega; restaurar transporte e abrir **nova** sessão, sem ressuscitar a antiga | `keycloak-real-jwt` na CI central, `iam07b-provider-recovery-ci.mjs` | Componentes reais/mesmo JWT humano/DBs físicos; não simula parada de cluster, TLS, backup nem HA. |
| G04 — org/módulo revogado | Com mesmo JWT válido, remover membership live Keycloak, Control link, entitlement e workspace SQL, além da tuple FGA; o SSE fecha e nenhuma nova notificação sai | `keycloak-real-jwt`, `iam07-sse-live-ci.mjs` | Exercitado no laboratório IAM-07A; não é uma transação distribuída que fecha a janela de efeito já iniciado. |
| G05 — atribuição concorrente | Duas atribuições reais disputam a conversa; revogação do destinatário bloqueia resultado, não altera assignment nem auditoria | `Regression / inbox`, `pg-assignment-races.mjs` em PG17 | Defende a operação de atribuição existente; não autoriza automaticamente capabilities novas `claim/transfer`. |
| G06 — funil/equipe | Estágios versionados CAS, dados tenant/Workspace, staff supervisor, origem/destino, auditoria append-only, viewer/revoked/FGA down | `Regression / service-management`, `service-funnels-pg17.test.mjs` | Service opt-in, não ativado no Host; não é prova de efeito SQL com revogação **Keycloak** simultânea. |
| G07 — HTTP existente | Regressão Nest Inbox com PostgreSQL real, HTTP 401/403/400, erros 503, isolamento tenant, deduplicação/atribuição e FGA provider injection | `Regression / inbox`, `inbox-pg-http.integration.mjs` | O verifier do fixture HTTP é injetado; **não** cobre sessão real Keycloak + controller HTTP no mesmo request. |
| G08 — isolamento | PG17 Org/Workspace/tenant, SQL002 físico no modo legado, tenant A/B, FGA cross-subject, user Manager isolado | `Regression / inbox`, `Regression / organizations`, `keycloak-real-jwt` | Org A/B no futuro modo multi-org permanece bloqueado por SQL002 no tenant operacional. |
| G09 — restore sintético | Após infraestrutura descartável, executar unit tests e NOVO Docker `--network none` PostgreSQL 17; `pg_dump -Fc`/SHA256/`pg_restore`, comparar ledgers Control+tenant, ACL e replay idempotente | `Regression / infra`, `disposable_restore_drill.py --disposable --ack-synthetic --json` com marcador `IAM09_SYNTHETIC_PG17_CONTROL_TENANT_RESTORE_DRILL_PASS` | Não substitui backup/restore operacional, backup offsite, credenciais, roles globais, RPO/RTO ou cutover. |
| G10 — UI/regressão | Builds, TypeScript, aplicações e smoke browser real com Keycloak/FGA/PG de cada suíte selecionada | Gate central `Syndes CI Gate` | Não é Product Gate de jornadas de cliente pagante. |
| G11 — governança | Preserva `main.ts` sem IAM piloto, não instala `service` no Host e mantém SQL002 | `Repository governance and planner regressions` | **Bloqueia ativação operacional** após simples aprovação de CI; exige rollout explícito futuro. |

## Invariantes de segurança para próximas implementações

- O usuário não escolhe database, grants, recurso confiável ou tenant persistido.
- IAM-06A permanece **shadow**, sem alterar decisão OpenFGA.
- Uma capability específica `inbox.conversation.claim`, `inbox.conversation.transfer` ou `service.funnel.operate` **não é equivalente** a `inbox:assignment/write` ou `inbox:messages/write`. Não construir essas features com grant largo.
- A revogação externa Keycloak/OpenFGA e o COMMIT PostgreSQL não compartilham transação. Para afirmar revogação atômica durante efeito será necessário um protocolo de fencing/epoch ou revalidação transacional e teste de corrida dedicado. **É um bloqueio conhecido, não um teste aprovado.**
- O SSE usa bus in-memory de Core Host único; qualquer escala horizontal exige broker e mecanismo de invalidação compartilhada.
- O `view-organizations` read-only de Keycloak 26.8.1 opera no realm inteiro: menor privilégio por org/FGAP continua em revisão.

## Resultado autorizável por este incremento

**Quando G01–G11 e `Syndes CI Gate` passarem no SHA exato da PR:**
- `NEXT_IMPLEMENTATION_GATE=ELIGIBLE_ON_GREEN_CI`: liberar desenvolvimento isolado de IAM-07B com controllers HTTP reais, autorização fina de claim/transfer/funil e fences SQL, mais instrumentos de recuperação/retry e documentação dos Product Gates. Isso **não** equivale a habilitar runtime em produção.
- `PRODUCTION_GATE=BLOCKED`: ainda bloquear migração real de Control, Keycloak realm `syndes`, SQL002 multi-org, troca de FGA, novas roles/grants operacionais, frontend com permissões simuladas ou instalador do Service.

**Para liberar IAM-09 operacional futuramente:** E2E Keycloak JWT + Nest HTTP real + tenant PG17 + Control PG17 + FGA em uma requisição; sessão SSE reconectada em proxy real; claim/transfer/funil com efeitos SQL + revogação simultânea sob locks; testes A/B físicos, backup/restore de staging com credenciais de runtime reais (sem PII), rollback de release, reconciliação, relatórios de latência sob carga/stress/soak, auditoria e aceite humano do produto. Nenhum destes será inferido a partir desta matriz.

## Execução

A CI central `.github/workflows/syndes-ci.yml` faz seleção por impacto: mudanças em `apps/core-host/test`, `tests/platform` e `scripts/ci` executam toda a suíte instalada, inclusive o job real `keycloak-real-jwt` de `.github/workflows/platform-manager.yml`. O novo ensaio não inicia ou conecta serviços externos; depende somente de containers descartáveis loopback do job preexistente.

Após CI aprovado, acrescentar **run ID, HEAD SHA, contagem dos jobs e marcadores G01–G03** neste registro e na Issue #160. Nunca declarar resultado sem logs.

## Gate de restore inserido no runner da CI

O `scripts/ci/run-suite.sh infra` agora exige `python3 -m unittest scripts/events/test_disposable_restore_drill.py scripts/events/test_staging_preflight.py` e executa o **restore inteiro** `python3 scripts/events/disposable_restore_drill.py --disposable --ack-synthetic --json` após a limpeza de `run-infra.sh`. O report deve comprovar PG17, formato e checksum SHA256 do archive, restaurados de Control/tenant, grant de acesso fechado, trigger do Control, consumer inbox/replay idempotente, fonte original intacta, `network:none`, `production_backup_verified:false`, `production_restore_approved:false` e `operational_ddl_executed:false`. Não é um teste sobre backups de clientes nem autoriza operação em produção.
