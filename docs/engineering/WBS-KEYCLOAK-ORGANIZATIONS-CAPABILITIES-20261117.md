# WBS — IAM Keycloak Organizations + Capabilities (piloto CRM/Inbox/Funis)

**Baseline:** realm syndes Keycloak 26.8.1; Core Kernel + Control DB + OpenFGA em uso. **Decisão:** ADR-KEYCLOAK-ORGANIZATIONS-CAPABILITIES-20261117.md. **Status:** execução inicial **sem operação**. A WBS não libera UI, OpenFGA retirement, migrations, nem deploy; o Product Gate CRM/Inbox continua pendente.

## Sequência e aceites

| ID | Prioridade | Entrega | Critério verificável | Estado |
|---|---|---|---|---|
| IAM-00 | P0 | Inventariar fontes de identidades, memberships, capabilities e grants | Documentar pontos atuais Keycloak/Control/Org-DB/FGA, evitar novo grant SQL duplicado | ANÁLISE / ADR |
| IAM-01 | P0 | Catálogo v1 de capacidades observadas e propostas | Mesmo resource/action declarado nos plugins atuais; propostas sem herdar permissões amplas; IDs imutáveis | CODIFICADO, CI PENDENTE |
| IAM-02 | P0 | Contrato granular por recurso/escopo e adapter de avaliação Keycloak UMA | recurso tenant/org/workspace/funil; deny 403/false; outage/error/malformed fail-closed; sem bypass FGA | PILOTO ISOLADO, CI PENDENTE |
| IAM-03 | P0 | Prova Keycloak 26.8.1 em laboratório descartável | Realm descartável, resource server confidential, Enforcing, 2 usuários, 2 orgs, 2 workspaces e funis; 0 concessão cruzada; remoção segura | LAB REAL APROVADO — PR #162, CI 24/24 |
| IAM-04 | P0 | Associação Organization Keycloak ↔ platform_organizations do Syndes | IDs imutáveis, tenant explícito, state/audit, provisionamento e revogação idempotentes, sem depender de nomes | IAM-04B: SQL MANUAL + adapter PG17 e testes candidatos; CI/OPERAÇÃO PENDENTES |
| IAM-05 | P0 | AuthenticatedUser/Token+Context trusted para AuthorizationPort | Validação OIDC iss/aud/azp, membership tenant e org, vínculo workspace+funil, refetch server-side, nunca JWT em log; Manager isolado | IAM-05B: adapter API real + service account no laboratório; CI/JORNADA INTEGRADA PENDENTES |
| IAM-06 | P0 | Integrar capability check no backend apenas em modo shadow | Comparar Keycloak vs OpenFGA para mesmas chamadas, sem trocar decisões ou emitir grants; cobertura real de Inbox claim/transfer e Funis | PENDENTE |
| IAM-07 | P0 | Provar revogação, isolamento e performance | Grupo/membro revogado e UI/SSE concorrente; org A/B; tenant A/B; funil A/B; indisponibilidade Keycloak; medir latência/p95 sem PII | PENDENTE |
| IAM-08 | P1 | Administração delegada via Syndes | UI somente após APIs autenticadas e auditadas, grants mínimos e sync/reconciliação; sem admin Keycloak no browser | PENDENTE |
| IAM-09 | P0 | Product Gate, backup/restore, rollout e rollback | Comparação positiva e negativa real, recovery e custos; controle SHA; remover FGA de classe humana **somente** com equivalência e aprovação | BLOQUEADO |
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
- Status atual: **CÓDIGO NA BRANCH/CI A COMPROVAR**. Só marcar IAM-04B/05B como LAB REAL depois de verificar explicitamente jobs e sha; ainda faltam integração runtime, operação, teste real OIDC+Control+tenant SQL+FGA na mesma jornada, SSE/revogação e Product Gate. IAM-06 permanece shadow **NÃO ATIVADO**.
- Evidência e limites: `docs/engineering/IAM-04B-05B-PERSISTENCE-KEYCLOAK-PG17-20261118.md`.
- Preflight CD 44229567880: Tailnet e SSH passaram; preflight remoto falhou com `Core Host Compose service missing`. Não contornar.
