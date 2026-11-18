# WBS — IAM Keycloak Organizations + Capabilities (piloto CRM/Inbox/Funis)

**Baseline:** realm syndes Keycloak 26.8.1; Core Kernel + Control DB + OpenFGA em uso. **Decisão:** ADR-KEYCLOAK-ORGANIZATIONS-CAPABILITIES-20261117.md. **Status:** execução inicial **sem operação**. A WBS não libera UI, OpenFGA retirement, migrations, nem deploy; o Product Gate CRM/Inbox continua pendente.

## Sequência e aceites

| ID | Prioridade | Entrega | Critério verificável | Estado |
|---|---|---|---|---|
| IAM-00 | P0 | Inventariar fontes de identidades, memberships, capabilities e grants | Documentar pontos atuais Keycloak/Control/Org-DB/FGA, evitar novo grant SQL duplicado | ANÁLISE / ADR |
| IAM-01 | P0 | Catálogo v1 de capacidades observadas e propostas | Mesmo resource/action declarado nos plugins atuais; propostas sem herdar permissões amplas; IDs imutáveis | CODIFICADO, CI PENDENTE |
| IAM-02 | P0 | Contrato granular por recurso/escopo e adapter de avaliação Keycloak UMA | recurso tenant/org/workspace/funil; deny 403/false; outage/error/malformed fail-closed; sem bypass FGA | PILOTO ISOLADO, CI PENDENTE |
| IAM-03 | P0 | Prova Keycloak 26.8.1 em laboratório descartável | Realm descartável, resource server confidential, Enforcing, 2 usuários, 2 orgs, 2 workspaces e funis; 0 concessão cruzada; remoção segura | LAB REAL APROVADO — PR #162, CI 24/24 |
| IAM-04 | P0 | Associação Organization Keycloak ↔ platform_organizations do Syndes | IDs imutáveis, tenant explícito, state/audit, provisionamento e revogação idempotentes, sem depender de nomes | IAM-04B: PG17 REAL DESCARTÁVEL + CI 24/24 APROVADO; OPERAÇÃO PENDENTE |
| IAM-05 | P0 | AuthenticatedUser/Token+Context trusted para AuthorizationPort | Validação OIDC iss/aud/azp, membership tenant e org, vínculo workspace+funil, refetch server-side, nunca JWT em log; Manager isolado | IAM-05B: KEYCLOAK 26.8.1 REAL + SERVICE ACCOUNT LEITURA CI APROVADO; RUNTIME/JORNADA PENDENTES |
| IAM-06 | P0 | Integrar capability check no backend apenas em modo shadow | Comparar Keycloak vs OpenFGA para mesmas chamadas, sem trocar decisões ou emitir grants; cobertura real de Inbox claim/transfer e Funis | IAM-06A MERGED #166; IAM-06B LAB REAL COMPOSTO CI 24/24 E MERGED #167; RUNTIME/HTTP/CLAIM/TRANSFER PENDENTES |
| IAM-07 | P0 | Provar revogação, isolamento e performance | Grupo/membro revogado e UI/SSE concorrente; org A/B; tenant A/B; funil A/B; indisponibilidade Keycloak; medir latência/p95 sem PII | IAM-07A #169, IAM-07B TEST GATES #171 MERGED; IAM-07C #173 PROVEN; IAM-07D1 #175 + IAM-07D2 #177 + IAM-07D3 #178 + IAM-07D4 #179 MERGED, CI 24/24; CONTROLLER/ADMIN BYPASS/IAM09 BLOCKED |
| IAM-08 | P1 | Administração delegada via Syndes | UI somente após APIs autenticadas e auditadas, grants mínimos e sync/reconciliação; sem admin Keycloak no browser | PENDENTE |
| IAM-09 | P0 | Product Gate, backup/restore, rollout e rollback | Comparação positiva e negativa real, recovery e custos; controle SHA; preservar OpenFGA como motor de grants por recurso; Keycloak é único motor de identidade/credenciais; paridade e reconciliação sem dupla autoridade | BLOQUEADO |
| IAM-10 | P1 | Reavaliar service/event_delivery FGA separado | Não confundir grants de bots e workers com usuários; nenhum desligamento antes de desenho próprio | PENDENTE |

### Primeira entrega técnica nesta PR

- catalog/iam-capabilities.v1.json = índice versionado **sem grants** com campos status declared_legacy ou proposed.
- scripts/ci/keycloak-capabilities.test.mjs = fonte observada coincide com manifests atuais e não traduz proposed para read/write existente.
- apps/core-host/src/keycloak-authorization-pilot.ts = cliente UMA read-only isolado, sem alterações no main.ts, sem dependência ou segredo novo.
- apps/core-host/test/keycloak-authorization-pilot.test.mjs = matriz com escopo, negação, credenciais e outage mockadas.
- ADR + esta WBS = decisão, limites e plano de migração.

**ATENÇÃO:** tests com fetch stub e IDs sintéticos **não** constituem homologação de Keycloak Authorization Services real. A autorização positiva em modo shadow exige provisionamento de recursos/políticas no laboratório, conta humana real validada e teste de negações. O adapter do piloto não substitui o AuthorizationPort atual, que recebe apenas actor.id/tenantId/recurso/ação e não dispõe do token do usuário nem do contexto escopado.

### Critérios de entrada para IAM-03

1. Ambiente descartável escolhido, nunca realm syndes operacional ou tenant comercial.
2. Uma única autoridade de grants por classe, especificada; Keycloak Organizations Groups não são diretamente suportados nas Group Policies de Authorization Services (26.8.1). Provar alternativa em vez de simular integração.
3. Resource server dedicado e confidential com Enforcing; clients browser continuam públicos e PKCE.
4. Matriz de deny por tenant/org/workspace/funil e ticket UMA baseada no próprio usuário, não no token da conta administrativa.
5. Registro dos dados sintéticos e cleanup do laboratório; sem senha/token em issues ou logs.

### Critérios para IAM-06/IAM-09

Exigir: entitlement de módulo no Control; migrations Organizations/Service instaladas somente após restore comprovado; FGA service principals preservados; SQL002 mantido até corte multi-org aprovado; grants IAM reais provisionados; revogação durante SSE/transferência; trilha de auditoria, operação de suporte e rollback com data/stores verificáveis.

**Status de aceite:** desenho e piloto candidato, **não liberado para runtime nem produção**.

### Evolução IAM-03 — validação real na CI existente

O ensaio passa a rodar no job `keycloak-real-jwt` de Platform Manager, reutilizando o container Keycloak descartável do próprio job. Não existe uma stack ou workflow novo em produção. O ensaio cria o realm exclusivo `syndes-iam-lab-ci` e mede grants por capability, isolamento de usuário/empresa/funil e revogação de Organization. **Não presume** que políticas de usuário já incluem membership Organization. A decisão combinada deve negar mesmo se UMA isoladamente continuar concedendo após a retirada do membro.

Fix IAM-02: o adapter usa `RESOURCE_ID#SCOPE_NAME` com ID de recurso e nome de scope reconciliados com o catálogo; não substitui a política ativa FGA. Testes de mock mantidos, integração real somente após CI verde.

**Compatibilidade Keycloak 26.8.1:** a documentação da API UMA descreve `RESOURCE_ID#SCOPE_ID`, mas a implementação de resolução de scopes chama `scopeStore.findByName(resourceServer, scope)`. Portanto, o piloto valida ID/nome de scope reconciliados, mas envia o **nome canônico da scope** na permissão (`RESOURCE_ID#SCOPE_NAME`). Este comportamento precisa ser confirmado pela suíte real e novamente em upgrades; não assumir equivalência universal com outras versões. Referências: https://www.keycloak.org/docs/26.8.1/authorization_services/ e https://github.com/keycloak/keycloak/blob/main/services/src/main/java/org/keycloak/authorization/authorization/AuthorizationTokenService.java .

### IAM-04/05 — fatia isolada de admissão de contexto (2026-11-18)

O piloto em apps/core-host/src/iam-organization-context-pilot.ts conjuga ActorVerifier.verifyClient (porta), membership tenant, ModuleAccess, vínculo bidirecional único Organization Keycloak ↔ Organization Syndes, membership Keycloak ATUAL e resolveSelectedOperationalScope SQL (incluindo SQL002). Para escrita exige scopeWriteAllowed; operação de funil exige owner ativo no mesmo contexto. Retorna somente contexto trusted, **não concedendo capability UMA nem substituindo FGA**. Portas de associação e membership ainda requerem implementação com Control DB e Keycloak real, respectivamente. Nenhuma alteração em main.ts, migrations, grants ou runtime. Ver docs/engineering/IAM-04-05-ORG-BINDING-VERIFIED-CONTEXT-20261118.md.

O Product Gate permanece BLOQUEADO até portas reais, laboratório integrado e shadow IAM-06. No CD anterior (run 44229567880), falhou o preflight da Tailnet e o deploy foi pulado; não confundir essa falha operacional independente com progresso do IAM.


### IAM-04B/05B — execução via PR (18/11/2026)

- Schema manual candidato `infra/postgres/bootstrap/control-iam-org-links.schema`: Unicidade 1:1, ACL, role NOLOGIN para transição, CAS, request UUID/idempotência e auditoria. **Nenhuma aplicação em Control operacional**. PK/UNIQUE protegidos pelo PG; ownership de org no tenant depende de validação por operador confiável (sem FK cross-database).
- Adapter `apps/core-host/src/iam-organization-adapters.ts`: leitura do vínculo no Control com tenant ativo, Keycloak Admin REST `/organizations/{id}/members/{sub}` autenticado por client_credentials de secret file; deny-by-default. Nenhuma importação em `main.ts`.
- Testes adicionados: `iam-organization-adapters.test.mjs` (mock), `iam-organization-links-pg17.test.mjs` (PG17 descartável e composição sintética), `tests/platform/keycloak-organizations-authz-ci.mjs` (Keycloak 26.8.1 real com conta de serviço `view-users`). Suítes existentes de CI utilizadas; não há novo workflow.
- Status atual: **LAB REAL CI APROVADO — PR #164, run 44236143477, 24/24 jobs**. Laboratório PG17 real e Keycloak 26.8.1 validados no SHA 36765f4506319d611c7664626bf2b1152d6d6857; ainda faltam integração runtime, operação, teste real OIDC+Control+tenant SQL+FGA na mesma jornada, SSE/revogação e Product Gate. IAM-06 permanece shadow **NÃO ATIVADO**.
- Evidência e limites: `docs/engineering/IAM-04B-05B-PERSISTENCE-KEYCLOAK-PG17-20261118.md`.
- Preflight CD 44229567880: Tailnet e SSH passaram; preflight remoto falhou com `Core Host Compose service missing`. Não contornar.

- Evidência de merge: PR #164 mergeada na main em `b42038f01aabf154c975a345f22a64e1bdfbaf44`; CI pré-merge 44236143477: **24/24 sucesso**. No teste host, PG17 foi executado separadamente com marcador `IAM04B_DISPOSABLE_PG17_ACL_CONCURRENCY_AUDIT_PASS`; não confundir com os testes PG opcionais que são SKIP no `npm test` sem ambiente. CI da main pós-merge é gate adicional, distinto da prova PR.
- Menor conjunto de roles efetivamente comprovado no laboratório: `realm-management/view-users` + `realm-management/view-organizations`, cliente `fullScopeAllowed=false`. `view-users` isoladamente retornou 403. Roles são de leitura de realm, ainda não delegação per-organization via FGAP; não promover credencial no ambiente operacional sem escopo e Product Gate.

- Verificação CD pós-merge: run [44236978834](https://github.com/delmacy/syndes-system/actions/runs/44236978834) no SHA `b42038f01aabf154c975a345f22a64e1bdfbaf44` — Tailnet/SSH, checagem Compose read-only, JWKS Keycloak e OpenFGA passaram; `deploy` e `provision-homolog-identity` ficaram **skipped** (sem deploy IAM). A falha `Core Host Compose service missing` da run antiga 44229567880 não se reproduziu; causa-raiz anterior não comprovada, controles preservados.


### IAM-06A — candidato shadow isolado (18/11/2026)

- apps/core-host/src/iam06-shadow-compare-pilot.ts: OpenFGA decide primeiro, como único gate efetivo; UMA humano validado previamente é consultado somente em observação assíncrona limitada. FGA deny + UMA allow continua deny. Falha FGA deny; falha/timeout UMA não altera resultado FGA.
- apps/core-host/test/iam06-shadow-compare-pilot.test.mjs: matriz booleana allow/deny, contexto adulterado, viewer, outage e timeout, resource catalog divergente, baixo cardinalidade de métricas e limite de concorrência.
- Atenção: only declared_legacy inbox.conversation.read (inbox:conversations/read) e inbox.message.send (inbox:messages/write) possuem mapa FGA coarse. Não afirmar paridade, mesmo quando decisões coincidirem. claim, transfer e service.funnel.operate são proposed e não herdam um write genérico.
- Não alterado main.ts, controllers, SQL002, OpenFGA model/tuples, migrations, realm, usuário ou grants. A prova conjunta JWT humano+Control PG17+tenant PG+FGA real+Keycloak UMA e Product Gates IAM-07/09 continuam pendentes.
- Referência: docs/engineering/IAM-06-SHADOW-COMPARISON-ISOLATED-20261118.md. Estado CI inicial: PENDENTE de PR; não tratar o código como runtime integrado.


### IAM-06B — ensaio combinado no job existente (2026-11-18)

- `tests/platform/iam06b-composite-ci.mjs`: Keycloak 26.8.1 JWT com audience+azp, memberships Organizations reais, Control/tenant PostgreSQL 17 em databases separados, módulo ENABLED do Control, link auditado, SQL002, OpenFGA real e UMA no mesmo fluxo de teste.
- `.github/workflows/platform-manager.yml` mantém o job existente `keycloak-real-jwt`; acrescenta compilação dos adapters Host, OpenFGA 1.22.1 in-memory preso ao loopback e flag `IAM06B_DISPOSABLE_ONLY`. Não cria workflow lateral, realm operacional, migration ou deploy.
- Negativos: FGA deny / UMA allow, membership removida sob token assinado vigente, viewer escrevendo, módulo desabilitado, link Control revogado, identidade Manager de outro issuer, org divergente e tentativa segunda org bloqueada por SQL002.
- **Estado comprovado:** PR #167 CI 44277334326 (24/24 aprovados), merge `edd6e2c1c5aeaa0f278e3944d29af1b83336ed28`, marcadores `IAM06B_REAL_JWT_CONTROL_PG17_TENANT_SQL002_OPENFGA_KEYCLOAK_PASS` e `IAM06B_REAL_FGA_DENY_UMA_ALLOW_AND_LIVE_REVOCATION_PASS`. A prova não contém controllers HTTP/SSE, grants específicos para claim/transfer/funil, instalador físico, OpenBao/role tenant operacional ou migration 003 integral. Consultar `docs/engineering/IAM-06B-REAL-COMPOSITE-LAB-20261118.md`.
- Product Gate CRM/Inbox, IAM-07/09 e decisão efetiva OpenFGA permanecem inalterados. Logs devem conter apenas marcadores categóricos, sem JWT, sub, token de serviço ou IDs de tenant.

- Evidência: [PR #167](https://github.com/delmacy/syndes-system/pull/167), [CI 44277334326](https://github.com/delmacy/syndes-system/actions/runs/44277334326), [merge SHA](https://github.com/delmacy/syndes-system/commit/edd6e2c1c5aeaa0f278e3944d29af1b83336ed28). O runtime continua com OpenFGA; não aplicar schema manual no Control operacional.


### IAM-07A — candidato de revogação viva e SSE (18/11/2026)

- `modules/inbox/src/realtime.ts`: cada invalidação SSE em modo `revalidate` exige **checagem nova**; não reaproveita uma promise de período/invalidação anterior. Bursts coalescidos, erro e cliente lento fecham stream. O mecanismo já existente de modo legado permanece sem acoplamento IAM.
- `apps/core-host/src/iam07-sse-session-pilot.ts`: candidato **isolado** para abrir SSE apenas após JWT real + membership atual Keycloak + Control, tenant PG17 / SQL002 + módulo e link válidos + FGA. O callback volta a percorrer todos os checks; não é importado por main.ts/InboxHost.
- `modules/inbox/test/realtime.test.mjs` e `apps/core-host/test/iam07-sse-session-pilot.test.mjs`: corrida verificadora antiga x publicação nova, coalescência, revogação e falhas de fonte.
- `tests/platform/iam07-sse-live-ci.mjs`, chamado pelo lab `iam06b-composite-ci.mjs`: real Keycloak 26.8.1 e mesmo JWT humano, Control+tenant PG17 isolados, OpenFGA real e InboxChangeBus. Exige marcadores `IAM07_REAL_SSE_FGA_SQL_MODULE_LINK_ORG_REVOCATION_PASS`, `IAM07_REAL_SSE_CROSS_SCOPE_AND_PROVIDER_FAILURE_DENY_PASS` e p95 de amostra CI (14 consultas, sem PII).
- **CI real aprovado:** PR #169 run [44283576958](https://github.com/delmacy/syndes-system/actions/runs/44283576958), **24/24 sucesso** incluindo `Syndes CI Gate`; merge `948472f9a1e0a3672d2598549bb519228a94c96f`. Logs têm os dois marcadores IAM-07 e p95 36 ms/14 revalidações em laboratório descartável, **não SLO operacional**.
- **Permanecem abertos:** SSE HTTP/proxy real, expiração e reconexão token, races de efeitos SQL claim/transfer/funil, A/B com múltiplos Contexts (SQL002 bloqueia multi-org no tenant), fault injection independente e recovery providers, escala multi-Core Host e p95 produção. Não ativar IAM no runtime nem promover Keycloak UMA substituto do FGA. Ver `docs/engineering/IAM-07A-SSE-REVOCATION-LAB-20261118.md`.


**Evidência de laboratório:** run [44283576958](https://github.com/delmacy/syndes-system/actions/runs/44283576958), PR [#169](https://github.com/delmacy/syndes-system/pull/169). A falha intermitente de teardown foi corrigida removendo `DROP DATABASE ... WITH (FORCE)` e exigindo ausência de conexões ativas antes de remover o banco descartável. Nenhum IAM operacional foi ativado por esta entrega.


### IAM-07B — pré-desbloqueio da próxima implementação (2026-11-18)

- Bateria G01–G11 em `docs/engineering/IAM-07B-09-NEXT-STAGE-GATE-20261118.md` diferencia **aptidão para continuar implementando** de Product Gate de produção.
- `apps/core-host/test/iam07b-jwt-expiry-sse.test.mjs`: JWKS real local + RS256, expiração DURANTE SSE, rejeições nbf/iss/aud/azp/signature e impossibilidade de reiniciar com token expirado; teste do protocolo, não da rota HTTP real Keycloak.
- `tests/platform/iam07b-provider-recovery-ci.mjs`: em realm e databases PG17 descartáveis existentes, quatro falhas de transporte independentes (Keycloak Org, Control, tenant DB, OpenFGA) com mesmo JWT humano real, fail-closed e nova sessão após restauro de caminho; **não** cria workflow, cluster ou migração operacional.
- Mantém regressões existentes de atribuição concorrente PG17, Service Management em PG17, controller Inbox HTTP/PG e scope A/B; **adiciona execução obrigatória do restore sintético Control+tenant PG17 com checksums/ACL/replay na suíte infra**, mais UI/CI. Teste `scripts/ci/iam-next-stage-gates.test.mjs` bloqueia promoções operacionais acidentais (SQL002 / plugin Service desativado / IAM piloto fora de `main.ts`).
- **Estado comprovado:** PR #171 MERGED `1e78434ce445b39d0d16efb7420d1e38bdfa05c9`, CI [44294919766](https://github.com/delmacy/syndes-system/actions/runs/44294919766) **24/24 verde** na tentativa final e job infra repetido com sucesso. Marcadores JWT, SSE, quatro provedores e `IAM09_SYNTHETIC_PG17_CONTROL_TENANT_RESTORE_DRILL_PASS` nos logs. **Apto a continuar desenvolvimento**, não IAM-09/produção. Uma execução prévia de restore [44294244321](https://github.com/delmacy/syndes-system/actions/runs/44294244321) falhou com `DrillError` genérico; causa ainda não comprovada, portanto manter acompanhamento de intermitência. Faltam controller HTTP com JWT Keycloak na mesma jornada, revogação de operações transacionais com fencing, multi-host SSE, FGAP mínimo, backup/restore de staging/produção e aceite do Product Gate.

- Infra CI pós-`run-infra.sh`: `disposable_restore_drill.py --disposable --ack-synthetic --json` com Docker PG17 totalmente isolado e sem rede/portas; exigir marcador `IAM09_SYNTHETIC_PG17_CONTROL_TENANT_RESTORE_DRILL_PASS`. **Isso não é backup nem restore operacional**; Product Gate IAM-09 continua bloqueado até recuperação de staging real.


### Evidência de aceite em 2026-11-18

- `IAM07B_SIGNED_JWT_EXP_NBF_AUD_ISS_AZP_SIGNATURE_DENY_PASS` e `IAM07B_SIGNED_JWT_EXPIRES_DURING_LIVE_SSE_PASS`: job `Regression / host` verde no SHA da PR #171.
- `IAM07B_REAL_KEYCLOAK_CONTROL_TENANT_FGA_TRANSPORT_FAULT_RECOVERY_PASS`: job `keycloak-real-jwt` com 26.8.1 + Control/tenant PG17 + OpenFGA real descartáveis. Falha e retorno de transporte, **não HA operacional**.
- `IAM09_SYNTHETIC_PG17_CONTROL_TENANT_RESTORE_DRILL_PASS`: job `Regression / infra`, incluindo 13 unitários e restore completo isolado. Verificado na tentativa inicial bem-sucedida e na reexecução do job (GitHub run 44294919766, tentativa 2). Sem backup de dados operacionais.
- **Risco de intermitência não resolvido:** run anterior 44294244321 executou 13 testes unitários verdes, mas seu restore retornou `DrillError` genérico. O código agora emite **somente a etapa segura** quando um erro reaparecer; a causa original não pôde ser recuperada da evidência existente. Duas execuções seguintes passaram. Não classificar como correção de causa-raiz; reabrir investigação se houver recorrência.
- **Próxima implementação autorizada:** IAM-07B HTTP com bearer real no mesmo controller, revogação/fencing na transação de claim/transfer/funil e recovery escalável. **Bloqueado ainda:** IAM-09 release, realm e bancos operacionais, multi-org SQL002, OpenFGA replacement, Service rollout, rollout frontend, backup/restore staging real e Product Gate.


### IAM-07C — implementação HTTP e SQL-local fencing em validação (18/11/2026)

- `apps/core-host/src/iam07c-http-admission-pilot.ts`, `tests/platform/iam07c-nest-http-ci.mjs`: Nest real na fixture Keycloak 26.8.1 + JWT humano / Control PG17 / tenant PG17 / FGA real. Probe read-only descartável, não instalado no Core Host operacional; expectativas 401/403/200 e revogação/recovery por provider.
- `modules/service-management/src/service.ts`: membership SQL com `FOR SHARE OF w,o,om,wm` até COMMIT da transação pinned. `service-funnels-pg17.test.mjs` bloqueia publicação por owner revogado, não altera dados/auditoria e permite após restauração.
- `modules/inbox/src/postgres.ts`: transferência de workspace usa lock em conversa e membership origem/destino na mesma instrução SQL do efeito/audit. `pg-transfer-revocation-races.mjs` testa duas workspaces somente dentro de schema próprio descartável (índice SQL002 suspenso apenas ali). Runner Inbox central já seleciona o teste novo.
- **Status:** código integrado na `main` em `57c722658a4186cc50f2181d3613de2f1bc3153b` via PR #173; [CI 44301444684](https://github.com/delmacy/syndes-system/actions/runs/44301444684) **24/24 PASS**, com os três marcadores IAM07C presentes nos jobs reais. Nenhuma ativação IAM operacional. **Limite essencial:** bloqueio transacional vale apenas para revogação **SQL no mesmo database**, não Keycloak/FGA remoto; não habilitar IAM coarse claim/transfer/funnel, multi-org operacional, Service plugin, `main.ts` ou migrações.
- Próximo bloqueio `IAM-07D`: externalized revocation epoch/fencing com eventos confiáveis e autorização específica por ação; IAM-09 exige controller de negócios real + Product Gates. Relatório `docs/engineering/IAM-07C-NEST-HTTP-SQL-REVOCATION-FENCE-20261118.md`.


### IAM-07D1 — contrato de revogação tenant-first (18/11/2026)

- `modules/organizations/sql/008_iam07d_revoke_first_candidate.sql`: migration de laboratório/manual em tenant PG17 com epoch monotônico por `(tenant, org, workspace, principal, capability)`, sem grant, sem wildcard, index SQL002 obrigatório e ausência de linha = negação.
- `infra/postgres/bootstrap/control-iam07d-revocation-receipts.schema`: recibo Control/manual escrito somente após commit do fence no tenant; operação idempotente/recuperável. Não equivale à outbox ou à ativação de Admin API.
- `apps/core-host/src/iam07d-revoke-first-pilot.ts`: ticket emitido apenas após `OrganizationContextAdmissionPilot` e política independente da capability exata; efeito e auditoria obrigatoriamente no mesmo `TrustedTenantTransactionProvider`, guardando `FOR SHARE` na linha de epoch e memberships até o commit. `revoke` altera primeiro tenant, depois recibo Control; falha do Control não reabre permissão.
- `apps/core-host/test/iam07d-revoke-first-pg17.test.mjs`: Teste integrado na suíte `Regression / host` usando dois databases PG17 CI separados, concorrência em ambas as ordens, idempotência, stale ticket, falha/retry Control e ausência de falsa equivalência coarse.
- **Estado comprovado:** PR #175 integrada na `main` em `1f4d2bd95d64f8cce85365c1b8a6570d5a6e643b`, [CI 44304717576](https://github.com/delmacy/syndes-system/actions/runs/44304717576) **24/24 aprovado** com ambos os marcadores IAM07D no job Host PG17. **PRODUCTION_GATE=BLOCKED**: sem integração com controller negócio, sem OpenFGA fine-grained real, sem interceptação de revogações diretas Keycloak/FGA, sem serviço/outbox administrativo/dispatcher. Relatório `docs/engineering/IAM-07D1-REVOKE-FIRST-FENCE-20261118.md`.


### IAM-07D2 — grants finos e outbox tenant-first (18/11/2026)

- Modelo candidato `infra/security-access/fga-model-iam07d2-candidate.json`, separado de `fga-model.json`: tipo `iam_capability` somente `grantee -> can_execute`, sem herança de permissões genéricas. `apps/core-host/src/iam07d-fine-fga-policy.ts` deriva objetos imutáveis de tenant/org/workspace/capability/funnel (hash SHA256) e realiza consultas e exclusão de tuple exatas no OpenFGA.
- `apps/core-host/src/iam07d-revoke-first-pilot.ts` passa a revalidar JWT Keycloak Organizations + Control + SQL context + FGA **na execução**, além da emissão do ticket e da revalidação do fence SQL em transação.
- Tenant migration manual candidata 008 inclui `platform_iam_revocation_outbox` no mesmo COMMIT da mudança `epoch`/revoked, e catálogo `platform_iam_fga_grant_targets` de reconciliação sem grants. `Iam07dRevocationOutboxDispatcher` só confirma entrega após fence SQL revogado, exclusão FGA específica e reconciliação Control; falhas deixam pendência e nova tentativa.
- `tests/platform/iam07d2-fine-fga-live-ci.mjs` executa contra o laboratório **REAL descartável** Keycloak 26.8.1/PG17/OpenFGA 1.22.1 do pipeline central: assinatura e membership, claim vs transfer, funil A/B, outbox pós-COMMIT, perda de Control/FGA, replay idempotente. `apps/core-host/test/iam07d2-fine-policy.test.mjs` complementa negativos de input e transport.
- **Estado:** IAM-07D2 MERGED PR #177 (CI [44309115757](https://github.com/delmacy/syndes-system/actions/runs/44309115757) 24/24). `PRODUCTION_GATE=BLOCKED`: sem proteção contra admin Keycloak/FGA fora do canal tenant-first; sem registro obrigatório e completo de grant targets; sem vínculo a controllers de negócios/Service; sem prova full-E2E/restore operacional. Detalhes em `docs/engineering/IAM-07D2-FINE-FGA-OUTBOX-20261118.md`.


### IAM-07D3 — Inbox real sob IAM granular (18/11/2026)

- `apps/core-host/src/iam07d-inbox-business-pilot.ts`: operações `claim` e `transfer` chamam o repositório Inbox original usando **exatamente o mesmo objeto de transação pinned** que verificou `Iam07dRevokeFirstPilot`. Claim usa row lock em conversa sem assignee e evita assumir conversa já atribuída; transferência exige capability independente.
- `tests/platform/iam07d2-fine-fga-live-ci.mjs`: amplia o laboratório com migrations CRM/Inbox/WhatsApp/ownership em tenant PG17 descartável, JWT Keycloak real e store OpenFGA separado. Comprova primeira claim e um evento de auditoria, retry indevido negado, transferência sem grant negada e ausência de mutação/auditoria após FGA revogado ou epoch tenant revogado enquanto tuple remota continua ALLOW.
- **Status:** IAM-07D3 MERGED PR #178 (CI [44312054884](https://github.com/delmacy/syndes-system/actions/runs/44312054884) 24/24), marcadores claim JWT real e transfer PG17 isolado confirmados. **BLOQUEIOS:** endpoint de negócio operacional não conectado, transferência cross-workspace provada com PostgreSQL real e política/JWT stub no schema descartável (marcador `IAM07D3_PG17_REAL_TRANSFER_EPOCH_AUDIT_PASS`), mas sem JWT Keycloak real na mesma requisição e sem liberação SQL002 operacional, Service Management/funil ainda fora da mesma transação, revogações administrativas out-of-band não são atômicas; Product Gate IAM-09 bloqueado. Relatório `docs/engineering/IAM-07D3-INBOX-COMMIT-FENCE-20261118.md`.

- **IAM-07D3 transferência:** teste `modules/inbox/test/pg-transfer-revocation-races.mjs` integra `Iam07dInboxBusinessPilot.transfer` ao PostgreSQL 17 real, two-workspace schema de laboratório e migration 008 tenant-only. Requer cap exata, transação pinned, audita operação autorizada, nega stale epoch sem nova alteração. **Não** é teste de JWT Keycloak real no mesmo request, nem substitui a barreira SQL002 de produção.


### IAM-07D4 — avanço de atendimento Service sob fence (2026-11-18)

- Refatoração `ServiceFunnelService.advance/advancePinned` reutiliza **uma única** função privada `advanceMutation` para preservar versão CAS, trigger de auditoria, membership ativa e controle do módulo. A variante pinned executa **a mesma transação tenant** fornecida pelo IAM, sem abrir outra.
- `Iam07dServiceFunnelBusinessPilot`: emite ticket exclusivamente para `service.funnel.operate`, verifica `funnelId` na attendance e executa o avanço dentro da transação do `Iam07dRevokeFirstPilot` com row lock.
- `service-funnels-pg17.test.mjs`: amplia bateria Service real PG17, SQL002 + candidate 008 apenas CI, política/admission stubs (não se apresenta como E2E Keycloak), avanço real+auditoria, CAS, funil cruzado negado, revogação de epoch nega mutação apesar de policy ALLOW. Exigir marcador `IAM07D4_PG17_REAL_SERVICE_FUNNEL_EPOCH_AUDIT_PASS` na suite Service e CI central verde.
- **Estado:** IAM-07D4 MERGED PR #179, commit `802e9d23891e028bd4e319b8998d3c51a5e1dfd0`, CI [44315562330](https://github.com/delmacy/syndes-system/actions/runs/44315562330) **24/24** e marcador `IAM07D4_PG17_REAL_SERVICE_FUNNEL_EPOCH_AUDIT_PASS` no job Service Management. **PRODUCTION_GATE=BLOCKED**: não ativar Service no Host, não substituir CoreKernel, ainda precisa de integrações operacionais para assign/open/close/transferTeam, API JWT real no mesmo negócio, administração tenant-first exclusiva, reconciliação de grants out-of-band, staging restore/rollback, multi-host e aceite IAM-09. Documento `docs/engineering/IAM-07D4-SERVICE-PINNED-FUNNEL-20261118.md`.


### IAM-TOPOLOGY-01 — contrato congelado para credenciais e multi-organização (2026-11-18)

- **Decisão:** `ADR-IAM-IDENTITY-AUTHORITY-MULTIORG-20261118.md`. Keycloak é **única engine de credenciais e identidade**. OpenFGA é autorização por recursos/relações, sem credenciais/usuários próprios. Control = tenant/entitlements/link; tenant DB = estrutura e fence; Syndes Core = enforcement. Keycloak UMA não é segundo grant ativo sobre capability coberta pelo OpenFGA.
- **Cardinalidade alvo:** 1 tenant / 1 DB → N organizations → N workspaces por org → N funis por workspace. O SQL Service implementado atribui **exatamente um workspace por funil**; a ideia histórica de funil reutilizado N:N entre workspaces não é scope do MVP.
- **Baseline real:** Organizations 001 e Service 001 já modelam hierarquia e FKs compostas; 002 impede multi-org real. `apps/core-host/test/iam-multiorg-authority-contract.test.mjs` registra invariantes como teste de regressão de código. `tests/platform/iam-multiorg-structural-pg17-ci.mjs` faz prova estrutural adicional em PG17 real descartável no job `keycloak-real-jwt`: transação isolada com remoção temporária de SQL002, 2 orgs × 2 workspaces × 2 funis, guardas de escopo e rollback restabelecendo os dois índices. Isso **não** prova Keycloak membership B nem FGA granular por funil B no mesmo request, nem autoriza cutover operacional.
- **TOPO-02 — P0:** inventário/correção de todas as leituras e escritas tenant-wide em CRM/Inbox/WhatsApp/Service, SSE, exports, search e workers. Exigir 2 orgs × 2 workspaces × 2 funis no mesmo tenant descartável com denials cross-org/ws/funnel, mesmo token humano Keycloak, Control, FGA e audit SQL.
- **TOPO-03 — P0:** substituir a dependência SQL002 de IAM07D migration 008/fence antes do corte; produzir migration operador-only aditiva/reversível, sem desligar fence. Reconciliar links org A/B no Control sem unicidade por tenant, apenas por organização.
- **TOPO-04 — P0:** restore/rollback staging, grants mínimos, isolamento de usuários e service accounts, SSE multi-host, revisão de índice SQL002 e gate explícito; nunca remover índices em PR de documentação, em CI de desenvolvimento ou por toggle apenas.
- **Estado:** CONTRATO + TESTE DE REGRESSÃO E LAB PG17 CANDIDATOS; CI pendente até execução do pipeline central. **Nenhum endpoint de criação multi-org, realm, DDL operacional ou deploy ativado. PRODUCTION_GATE=BLOCKED.**


### TOPO-03A — prova SQL de fence IAM-07D no mesmo tenant multi-org (2026-11-18)

- A suite `tests/platform/iam-multiorg-structural-pg17-ci.mjs` amplia o ensaio PostgreSQL 17 descartável 2×2×2 sem SQL002 **apenas dentro de rollback-only transaction**. Instala linhas de fence IAM por `tenant_id,organization_id,workspace_id,principal_id,capability`, revoga somente org B/workspace B1 por CAS de epoch e persiste outbox na mesma transação; garante org A/workspace A2 ainda ativa e outbox limitada à org B.
- Marcador esperado `IAM_TOPOLOGY_PG17_CROSS_ORG_EPOCH_OUTBOX_FENCE_ISOLATION_PASS`. Resultado CI não presumido antes de execução.
- O teste usa SQL PG17 real, mas NÃO comprova serialização de revogação concorrente com operação em outra conexão, nem revogação direta Keycloak/FGA, nem entrada por HTTP com duas memberships reais. `008_iam07d_revoke_first_candidate.sql` continua exigindo SQL002 no preflight e **não pode ser instalado a frio após cutover**; isso requer revisão específica e recuperação de staging antes de ativar multi-org. Este teste não altera a migration 008 nem runtime.
- `PRODUCTION_GATE=BLOCKED`; SQL002 físico permanece intacto após rollback. Sem alteração de realm, grants, banco operacional ou deploy.


### TOPO-03B — instalador alternativo de fence após SQL002 (2026-11-18)

- PR de candidato: `modules/organizations/sql/009_iam_multiorg_fence_candidate.sql`, DDL **idêntico** ao 008 para capability fences, catálogo de alvos FGA e outbox, mas preflight distinto: exige remoção conjunta anterior dos dois índices SQL002 e FKs reais de ownership/operational memberships. `008` original permanece intocado, válido apenas em single-org.
- A suíte PG17 no laboratório IAM-06B é ampliada para exigir 009 DENY com SQL002 completo, DENY com remoção parcial (um índice restante), 008 DENY sem índices, 009 instalação com ambos ausentes, rollback e índices preservados. Marcador esperado: `IAM_TOPOLOGY_PG17_POST_SQL002_FENCE_INSTALLER_PASS`.
- **Não concluir cutover**: esse teste demonstra compatibilidade do DDL, mas não aprovação das rotas CRM/Inbox/WhatsApp tenant-wide, da serialização concorrente entre conexões, Keycloak org B real ou rollback/restauração em staging. Migration 009 permanece manual/CI e NÃO pode ser incluída em instalação automática do plugin; `PRODUCTION_GATE=BLOCKED`.


### TOPO-03C — corrida real de commit revogação/escrita em duas conexões PG17 (2026-11-18)

- Teste novo `tests/platform/iam-revocation-concurrent-pg17-ci.mjs` roda no job `keycloak-real-jwt` existente, com **duas conexões físicas independentes** PostgreSQL17 do tenant descartável (sem alterar nenhum banco operacional). Verifica o fence da capability `inbox.conversation.transfer` já provisionado pelo laboratório IAM07D2.
- **Write-first:** transação A adquire `FOR SHARE` sobre o fence, grava efeito, transação B tenta `FOR UPDATE NOWAIT` e recebe `55P03`; A faz commit. Revoke não consegue antecipar operação que obteve lock primeiro.
- **Revoke-first:** transação B atualiza state+epoch e grava outbox **no mesmo commit**; transação A tenta `FOR SHARE NOWAIT` e recebe `55P03`; antes de B confirmar a outbox é invisível; após B confirmar, `state='active'` retorna zero e a outbox é visível como `pending`; efeito não é gravado novamente.
- Marcadores esperados `IAM_TOPO03C_PG17_WRITE_FIRST_LOCK_SERIALIZATION_PASS` e `IAM_TOPO03C_PG17_REVOKE_FIRST_STALE_WRITE_DENY_OUTBOX_ATOMIC_PASS`. CI e aceite **pendentes** até execução real.
- **Limites:** demonstra serialização tenant-local para uma scope já existente, não valida corrida remota Keycloak/OpenFGA vs commits SQL, SLA SSE ou dois bancos de tenant distintos. Cutover multi-org e produto continuam bloqueados. `PRODUCTION_GATE=BLOCKED`.


### TOPO-04A — duas Organizations Keycloak reais no mesmo tenant e HTTP FGA (2026-11-18)

- Piloto HTTP `apps/core-host/src/iam-topology-multiorg-http-pilot.ts` e suíte `tests/platform/iam-multiorg-keycloak-fga-http-ci.mjs` **exclusivamente no laboratório descartável** `keycloak-real-jwt`. A CI cria segundo `platform_organization` no **mesmo banco físico de tenant**, 2 workspaces por organização, dois vínculos Control distintos 1:1 para Keycloak Organizations A/B reais e o mesmo usuário humano com membership atual em A e B.
- Em banco descartável, os dois índices SQL002 são retirados **numa transação pinned e confirmada** apenas como preparação do laboratório; o banco inteiro é destruído no teardown. Nada disso acontece em tenant operacional, migrations automáticas ou servidor. O piloto recupera a Organizations membership atual por Keycloak Admin API, confirma Control link por direção dupla, Control module entitlement, org/workspace membership SQL e grant exato OpenFGA `iam_capability` dentro do mesmo GET Nest HTTP de admissão.
- Regressões previstas: mesmo JWT acessa Org A/Workspace A1 e Org B/Workspace B1 com duas tuples FGA distintas; sem grant em A2/B2 nega; contexto cruzado org/workspace nega; token Manager/ausente/inválido nega; revogação live da Keycloak Org B nega B e mantém A; exclusão de tuple de A nega A e mantém B; revogação SQL workspace B nega B e mantém A; revogação do link Control B nega B e mantém A; restauração explícita reativa só a permissão correta.
- Marcadores esperados: `IAM_TOPO04_REAL_TWO_KC_ORGS_SAME_TENANT_HTTP_FINE_FGA_ISOLATION_PASS`, `IAM_TOPO04_REAL_KC_ORG_B_REVOKE_A_STAYS_ACTIVE_PASS`. **Não afirmar aprovado antes de CI verde.**
- **Limites:** rota é read-only admission probe, não operação Inbox mutável nem operação Service; não há concorrência Keycloak/FGA vs commit, nem SSE de longa duração, nem migração staging/restore ou auditoria integral de CRM/Inbox/WhatsApp tenant-wide. `PRODUCTION_GATE=BLOCKED`.


### TOPO-04B — Inbox claim real sob IAM multi-org (2026-11-18)

- Candidata `apps/core-host/src/iam-topology-inbox-claim-http-pilot.ts`, CI-only, POST Nest para `Inbox.claim` real por `Iam07dInboxBusinessPilot`; `tests/platform/iam-multiorg-keycloak-fga-http-ci.mjs` passa a montar esse controlador no laboratório com duas Keycloak Organizations reais, um tenant PG17 e OpenFGA exato.
- A claim usa JWT humano validado, membership Keycloak atual, Control org link + module entitlement, SQL org/workspace, FGA granular e `IAM07D` epoch fence em transação pinned. Prova esperada: claim A/B, 1 evento de auditoria por conversa, 403 para troca de org/workspace, claim duplicada, outro usuário/Manager e revogação B sem afetar A. Marcador: `IAM_TOPO04B_REAL_MULTI_ORG_INBOX_CLAIM_SQL_AUDIT_AND_SCOPED_REVOKE_PASS`.
- Esta fatia **não monta rota operacional nem substitui legacy Inbox**, não prova Service mutating HTTP, transfer concorrente, exportações ou SSE com dois tenants; `PRODUCTION_GATE=BLOCKED`.

### UC-SIGNUP-01A — Wizard Tenant → primeira Organization → primeiro Workspace

- Documento de produto `docs/product/UC-SIGNUP-TENANT-ORGANIZATION-WORKSPACE-WIZARD-20261118.md`: caso de uso, user stories, fluxo OIDC Keycloak exclusivo, saga de criação no Control/installer, vínculo org Keycloak ↔ Platform Organization, grants FGA exatos, idempotência, rollback/reconciliação e mobile.
- Backend `OrganizationService.bootstrap` e controller aceitam nomes opcionais validados `organizationName`/`workspaceName`, sem alterar a CTE idempotente, ownership de primeiro escritor e FGA obrigatório. Testes regressivos novos para validação de campos e defaults existentes.
- **UC-SIGNUP-01B/C/D/E PENDENTES:** intenções de signup duráveis no Control (ACL/CAS), provisionador confiável de tenant DB e Organization Keycloak, API de status e wizard frontend acessível, staging restore e E2E com falhas. Não criar conta pela UI antes da autoridade de tenant estar comprovada. SQL002 intacto e `PRODUCTION_GATE=BLOCKED`.


### TOPO-05A — fail-closed SSE operacional no limiar de multi-org (2026-11-18)

- A rota Inbox SSE só pode subir com `SYNDES_MULTI_ORG_ENABLED=true` se o Core Host configurar `inboxModuleGateMode=enforce`; caso contrário o Host Inbox recusa inicializar. O bus recusa qualquer canal tenant-wide e exige callback de revalidação vivo para conexões sob multi-org; a publicação de invalidations org/workspace continua isolada.
- Testes `modules/inbox/test/realtime.test.mjs` comprovam negação de subscribe/publish/connect sem escopo, ausência de revalidação e isolamento de A/B no mesmo tenant, além de preservar cenário legado quando flag desativada.
- A alteração **não** habilita multi-host: InboxChangeBus continua in-memory por processo e requer broker compartilhado antes de escalar instâncias. Também não substitui a autenticação de Organizations Keycloak no Inbox operacional legacy: o IAM real continua CI-only até product gate. `PRODUCTION_GATE=BLOCKED`.


### TOPO-05B — fail-closed Control entitlement CRM + WhatsApp (2026-11-18)

- Quando `SYNDES_MULTI_ORG_ENABLED=true`, `CrmDefaultContextGuard` **recusa o modo legacy**, mesmo com seleção org/workspace válida; requer `crmModuleGateMode=enforce` e `CoreKernel.executeModule` antes de abrir o banco.
- `WhatsAppDefaultContextGuard` passa a usar `CoreKernel.executeModule({moduleId:'whatsapp'})` antes de resolver o escopo selecionado no mesmo modo. Falha de Control ModuleAccess/membership/FGA recusa a operação sem lease de tenant. Modo single-org continua o caminho legacy.
- Unit tests em `modules/core-crm/test/context-guard.test.mjs` e `modules/whatsapp/test/scope.test.mjs` verificam denials e ordem tenant→FGA→Control→tenant DB.
- Estas verificações são **necessárias, mas não suficientes**: Operations continuam sem revalidação Keycloak Organizations nos controllers CRM/WhatsApp legacy; não há broker SSE multi-host nem proof de outbox/worker multi-org no Host operacional. NÃO habilitar multi-org ou remover SQL002 com apenas estas flags e testes. `PRODUCTION_GATE=BLOCKED`.


### TOPO-05C — Keycloak Organizations no Host OPERACIONAL (2026-11-18)

- Nova porta `OperationalOrganizationMembershipGate` exige **a cada operação** vínculo Control (tenant,org)→Keycloak org único, ativo, revision consistente, lookup reverso único e **membership atual Keycloak 26.8.1** por subject. Um JWT válido isoladamente não é autorização de Organization. Qualquer provider down/duplicidade/denial falha fechado, sem cache de membership.
- `CoreService` monta a porta read-only **somente** quando `SYNDES_MULTI_ORG_ENABLED=true`, com realm derivado de `CORE_KEYCLOAK_ISSUER` e serviço confidencial `CORE_IAM_ORG_READER_CLIENT_ID` + `CORE_IAM_ORG_READER_SECRET_FILE` (caminho absoluto protegido). Não há credencial de admin no browser. Sem estes recursos, modo multi-org impede inicialização; `readyz` verifica tabela imutável de links Control.
- CRM, Inbox HTTP e SSE `revalidateStream`, WhatsApp HTTP e Service Management HTTP passam a exigir a mesma porta **depois** da seleção SQL de org/workspace, **antes** do efeito de negócio. Service já valida membership SQL e FGA do módulo na transação. A fila WhatsApp continua service/event_delivery separado e não deve receber senha/usuário SQL.
- Teste unitário de porta com duplicidade, deriva de ID, revogação, indisponibilidade e lookup bidirecional; o laboratório real TOPO-04A também executa o novo gate contra duas Organizations reais (incluindo revogação live B e link Control B sem afetar A).
- **Pendências de Product Gate**: IAM07D fine epoch ainda não está ligado em *todas* as operações de Inbox/Service de produção; Service plugin é opcional e não auto-montado; provisionamento da segunda Org Keycloak + Control link sem órfãos (signup/admin saga) ainda falta; garantir isolamento de todas as consultas CRM/Inbox/WhatsApp e worker multi-org, SSE entre réplicas e staging restore. Não retirar SQL002 nem marcar multi-org como ON. `PRODUCTION_GATE=BLOCKED`.


### TOPO-05D — Teste de negócio Service com 2 Organizations e múltiplos funis (2026-11-18)

- A suíte real `modules/service-management/test/service-funnels-pg17.test.mjs` (PostgreSQL 17 em Docker descartável; tenant DB específico destruído em teardown) remove SQL002 **apenas nesse tenant de teste**, cria 2 Organizations no mesmo banco, 2 Workspaces por Organization e 2 funis novos por Workspace (8 novos funis).
- Exercita `ServiceFunnelService.publishSimpleFunnel`, `listFunnels`, `open`, `get`, `history` e `board` contra as quatro combinações com o **mesmo subject** membro das duas Organizations. Testa idempotency key igual em workspaces distintos sem colisão e exige cross-org/workspace deny (get null, history/board vazios, open rejeitado). Revoga membership somente B1 e comprova que A2/B2 continuam aptos a escrever e que B1 não cria funil.
- Marcador esperado `IAM_TOPO05D_REAL_SERVICE_TWO_ORGS_FOUR_WORKSPACES_EIGHT_FUNNELS_BUSINESS_ISOLATION_PASS`. Não anunciar aprovado antes do CI central completo. **Não** comprova JWT real do Keycloak nesse job específico nem FGA fino por funil; esses mecanismos são testados em IAM07D4 e no laboratório Keycloak multi-org, mas não juntos em uma rota Service operacional.
- **Ainda bloqueado:** cobertura integral de operadores/consumidores de WhatsApp, outbox/realtime multi-host, write gates IAM07D nos controllers Service/Inbox reais, provisionamento administrativo de uma segunda Organization, staging backup/restore e aprovação de migration de cutover. `PRODUCTION_GATE=BLOCKED`.
