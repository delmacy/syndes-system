# IAM-06A — Shadow comparison OpenFGA x Keycloak UMA isolado

Data: 2026-11-18. Estado: candidato isolado, sem import em main.ts, rota, controller, worker, alteração de realm, Control DB operacional, SQL002, grants ou deploy. OpenFGA permanece decisor operacional.

## Baseline
IAM-03 demonstrou que UMA concedida ao usuário pode permanecer positiva após remoção da Organization membership. IAM-04B/05B foram aprovados em CI descartável PostgreSQL17 e Keycloak 26.8.1 na PR #164 (24/24 jobs); nenhum adapter foi ligado ao runtime e o schema Control permanece manual. A PR #165 registrou essa evidência.

## Contrato IAM-06A

Implementado em apps/core-host/src/iam06-shadow-compare-pilot.ts, com portas injetadas:
- AuthorizationPort atual, efetivo apenas por OpenFGA;
- KeycloakUmaAuthorizationPilot com token humano já verificado, nunca token da conta administrativa;
- TrustedPilotResourceCatalog, que resolve IDs e nomes Keycloak por contexto trusted, nunca recebidos do navegador;
- Iam06ShadowMetrics, com uma categoria fixa por contagem, sem identificadores.

O caller deve executar previamente OrganizationContextAdmissionPilot.resolve, revalidar assinatura iss/aud/azp/sub, membership tenant, módulo ENABLED, link recíproco, membership Keycloak atual, org/workspace SQL e SQL002. O comparador pede primeiro a decisão FGA e devolve SOMENTE esse resultado; depois agenda UMA assíncrona em observação limitada, sem atrasar a resposta. UMA positiva não transforma uma negação FGA em autorização. FGA indisponível retorna false. Erros/timeout Keycloak ou sink de telemetria não alteram FGA.

## Limite de equivalência

Catálogo versionado distingue declared_legacy de proposed. Somente duas capacidades existentes admitem ligação ao FGA:
- inbox.conversation.read: inbox:conversations/read
- inbox.message.send: inbox:messages/write

Mesmo essas duas decisões FGA são COARSE (sem escopo por funil/workspace equivalente ao recurso UMA): concordância é apenas DIAGNÓSTICA, nunca paridade funcional. Por isso toda métrica de concordância usa o prefixo legacy_coarse.

inbox.conversation.claim, inbox.conversation.transfer e service.funnel.operate são proposed: não é seguro tratá-las como herança automática de read/write. O comparador não invoca FGA nem UMA para esses escopos e nega entrada nesse método. Para compará-las, definir checks efetivos específicos e ownership transacional em controllers, não inventar grants ou permissões por inferência.

## Segurança e observabilidade

Categorias permitidas: legacy_coarse_agree_allow, legacy_coarse_agree_deny, legacy_coarse_fga_allow_uma_deny, legacy_coarse_fga_deny_uma_allow, not_comparable, catalog_unmapped, shadow_error, shadow_capacity_skipped e fga_error. Nenhum JWT, principal, tenant, org, workspace, funil, resource ID ou corpo de mensagem entra no sink.

O limite de concorrência é 16 por instância (configuração válida 1..64), e o prazo de observação padrão é 3500ms (1..5000). O adapter UMA impõe timeout próprio de 3000ms. Sob sobrecarga descarta-se a observação, jamais a decisão FGA. O objeto de contexto congelado é apenas defesa adicional; não substitui admissão real. Inexistência de logger de dados brutos.

## Teste e classificação

Testes: apps/core-host/test/iam06-shadow-compare-pilot.test.mjs. Matriz allow/deny de FGA e UMA, falhas de FGA, Keycloak, catálogo, métrica, deadline, capacity, spoofing de contexto, viewer e capability proposta. Testes são UNITÁRIOS com providers simulados; CI do repositório valida regressão ampla. Não há prova E2E de autorização humana real no mesmo request.

## Pendências para IAM-06B / IAM-07 / IAM-09

1. Prova combinada em laboratórios descartáveis: JWT humano assinado pelo Keycloak 26.8.1, ActorVerifier, link PG17 Control, tenant PG, membership atual, módulo ENABLED, OpenFGA real e UMA para o mesmo request e recurso.
2. Comparação observacional de claim/transfer/funil após estabelecer semântica efetiva por operação, ownership e destino na mesma transação. Evitar declaração falsa de equivalência com write genérico.
3. Revogação durante sessão e SSE, limites p95, perda de rede/DB, auditoria sem PII, recuperação, análise de divergências.
4. A conta read-only testada requer view-users + view-organizations em realm-management; isso lê ao nível do realm, não é mínimo privilégio por empresa. Restringir acesso por organização e validar FGAP antes de credencial operacional.
5. Product Gates CRM/Inbox, IAM-09, rollback/restore e aprovação explícita antes de qualquer wiring operacional. Service/event_delivery continuam em OpenFGA e dependem de IAM-10.
