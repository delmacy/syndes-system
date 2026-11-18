# IAM-04/05 — Associação de Organizações e contexto OIDC confiável

Data: 2026-11-18. Estado: piloto isolado em código e testes. Nenhuma migration operacional, alteração de realm, grants, runtime ou deploy. Base: PR #162 e ADR-KEYCLOAK-ORGANIZATIONS-CAPABILITIES-20261117.md.

## Decisão

Keycloak é a autoridade da identidade, credenciais, convites e participação nas Keycloak Organizations. O Syndes Control Plane é a autoridade de tenant, catálogo comercial de módulos e associação Keycloak-Organization ↔ platform_organization. O banco tenant é a autoridade de workspace, funil, owner de conversa e regras transacionais.

A associação é um vínculo por IDs imutáveis, não uma cópia de usuário/organização nem um grant. Campos candidatos: realm, keycloakOrganizationId, tenantId, organizationId, state(active/revoked), revision. Unicidade global por realm+keycloakOrganizationId e por tenantId+organizationId; a fonte preferida futura é o Control Plane, mas nenhum FK cross-database para platform_organizations é possível. A criação do vínculo exige fluxo administrativo com revalidação de tenant ativo e org real no banco certo, transação idempotente, trava e auditoria.

Nesta entrega NÃO existe nova tabela, migration ou API administrativa. A porta OrganizationIdentityLinksPort exige consulta em ambas direções, sem ocultar duplicidades. O código nega ausência, duplicata, revogação, mismatch, revisão divergente e IDs inválidos. A persistência física e a reconciliação exigem novo aceite.

## Piloto IAM-05

Fonte: apps/core-host/src/iam-organization-context-pilot.ts. Não importado por apps/core-host/src/main.ts; OpenFGA continua sendo a decisão efetiva.

Ordem de avaliação:
1. Validar IDs, capability exata, cliente OIDC permitido por configuração trusted e rejeitar cliente do Platform Manager.
2. Verificar o bearer com VerifiedClientActorPort, cuja implementação real deve usar ActorVerifier.verifyClient existente para assinatura, issuer, audience e azp; não decodificar JWT sem verificar.
3. Exigir tenant membership ativa no Control Plane, depois módulo instalado/ENABLED/entitled pelo requireModuleAccess.
4. Validar associação Organization Keycloak ↔ platform_organization em AMBAS direções com realm, IDs, estado e revision idênticos.
5. Revalidar membership ATUAL do sub na Keycloak Organization, não apenas o claim do JWT, com porta de serviço de leitura; outage e 404 negam.
6. Resolver banco tenant por TrustedTenantDatabaseProvider, executar resolveSelectedOperationalScope com memberships SQL org/workspace, flag de servidor, backfill e SQL 002.
7. Escrita exige scopeWriteAllowed; funil exige owner ativo no mesmo tenant/org/workspace, por port de domínio confiável.
8. Produzir contexto congelado sem credencial nem token. Esse contexto NÃO é autorização para executar ação de negócio nem um substituto de UMA/FGA, ownership SQL ou verificação de destino.

Este piloto ainda usa interfaces de leitura e testes com portas simuladas, não integra provedor real Keycloak Organizations nem tabela Control. Os dados selecionados pelo navegador jamais são autoridade.

## Achado relevante e ameaça

IAM-03 provou com Keycloak real que policy UMA concedida diretamente ao usuário continua positiva depois que a membership dele na Keycloak Organization é removida. Portanto, uma decisão UMA positiva sem membership atual é insuficiente. Nunca aceitar apenas realm role, Keycloak Organization Group, scope OIDC de login, token emitido antes da revogação ou título Account Owner para ler dados CRM/Inbox. Funil e transferência têm predicados de domínio na mesma transação do efeito.

A consulta live entre Keycloak e PostgreSQL não fornece atomicidade distribuída: revalidar antes de efeitos de alto impacto e especificar SLA operacional para revogações.

## Evidência de código e gate

Testes em apps/core-host/test/iam-organization-context-pilot.test.mjs: ator inválido/service/Manager, tenant e módulo negado, link ausente/duplo/revogado/mismatched/revision, Keycloak member revogado/unavailable, SQL sem workspace ou de outro tenant, viewer tentando escrever, funil inválido, exceção de provider. O piloto não tem rota exposta nem executa migration ou grant.

O aceite real depende de CI no SHA, PostgreSQL 17 e Keycloak 26.8.1 descartáveis, e depois do Product Gate do ambiente operacional. Não declarar IAM-04 e IAM-05 completos como integração até haver ports reais, leitura autenticada e E2E.

## Etapa seguinte — IAM-04B/05B, depois IAM-06

1. Projetar e provar no PostgreSQL 17 descartável um schema Control de vínculo com unicidade global, FK dentro Control, estado, revisão, auditoria e escrita só por serviço operador autorizado. Nenhuma migration operacional automática.
2. Adaptador read-only parametrizado para links, proibindo limitar consulta a um registro que esconda duplicata; testes de concorrência e reconciliação.
3. Adaptador de membership Keycloak Organization usando API read-only com privilégio mínimo e credenciais protegidas; validar revogação no laboratório real (sem usar bootstrap-admin no runtime).
4. Reusar ActorVerifier e escopo SQL existente, testar sessão OIDC PKCE, tenant A/B, org A/B, workspace A/B, funil A/B, revogação, timeout e rollback. Não mexer SQL 002.
5. IAM-06 shadow comparison: decisão real continua OpenFGA, executar Keycloak UMA apenas para comparar sem produzir concessões.
6. IAM-09 Product Gate com backup/restauração, auditoria e teste de performance antes de qualquer cutover. Grants de services/worker seguem em revisão independente.

Tracking: Issue #160. Product Gate CRM/Inbox #101 continua OPEN. CD separado: preflight Tailnet do workflow 44229567880 falhou; job deploy não executou.
