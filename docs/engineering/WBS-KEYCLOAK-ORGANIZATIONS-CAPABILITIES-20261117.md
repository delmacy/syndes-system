# WBS — IAM Keycloak Organizations + Capabilities (piloto CRM/Inbox/Funis)

**Baseline:** realm syndes Keycloak 26.8.1; Core Kernel + Control DB + OpenFGA em uso. **Decisão:** ADR-KEYCLOAK-ORGANIZATIONS-CAPABILITIES-20261117.md. **Status:** execução inicial **sem operação**. A WBS não libera UI, OpenFGA retirement, migrations, nem deploy; o Product Gate CRM/Inbox continua pendente.

## Sequência e aceites

| ID | Prioridade | Entrega | Critério verificável | Estado |
|---|---|---|---|---|
| IAM-00 | P0 | Inventariar fontes de identidades, memberships, capabilities e grants | Documentar pontos atuais Keycloak/Control/Org-DB/FGA, evitar novo grant SQL duplicado | ANÁLISE / ADR |
| IAM-01 | P0 | Catálogo v1 de capacidades observadas e propostas | Mesmo resource/action declarado nos plugins atuais; propostas sem herdar permissões amplas; IDs imutáveis | CODIFICADO, CI PENDENTE |
| IAM-02 | P0 | Contrato granular por recurso/escopo e adapter de avaliação Keycloak UMA | recurso tenant/org/workspace/funil; deny 403/false; outage/error/malformed fail-closed; sem bypass FGA | PILOTO ISOLADO, CI PENDENTE |
| IAM-03 | P0 | Prova Keycloak 26.8.1 em laboratório descartável | Realm descartável, resource server confidential, Enforcing, 2 usuários, 2 orgs, 2 workspaces e funis; 0 concessão cruzada; remoção segura | PENDENTE |
| IAM-04 | P0 | Associação Organization Keycloak ↔ platform_organizations do Syndes | IDs imutáveis, tenant explícito, state/audit, provisionamento e revogação idempotentes, sem depender de nomes | PENDENTE; DDL somente após gates |
| IAM-05 | P0 | AuthenticatedUser/Token+Context trusted para AuthorizationPort | Validação OIDC iss/aud/azp, membership tenant e org, vínculo workspace+funil, refetch server-side, nunca JWT em log; Manager isolado | PENDENTE |
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
