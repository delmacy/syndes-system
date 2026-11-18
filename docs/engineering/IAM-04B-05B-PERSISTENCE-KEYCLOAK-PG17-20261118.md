# IAM-04B / IAM-05B — Control link persistente e Membership API real (candidato)

Data: 2026-11-18. Escopo: branch feat/iam04b-05b-pg-keycloak-20261118, Issue #160.
**Status de entrega:** laboratório PostgreSQL 17 + Keycloak 26.8.1 real aprovado na PR #164, CI 44236143477 (24/24). Merge `b42038f01aabf154c975a345f22a64e1bdfbaf44`. **NÃO integrado ao Host runtime; não homologado; não aplicado ao Control DB real.** A autoridade efetiva de autorização de dados permanece OpenFGA.

## 1. Divisão canônica

- Keycloak 26.8.1: sujeito imutável (sub), credenciais, MFA, membership de Organizations; não é owner de tenant DB ou workspace.
- Syndes Control: tenant registry, tenant membership, entitlement e **índice de vínculo** Organization (realm+Keycloak org UUID) ↔ (tenant UUID+platform org UUID).
- Banco de cada tenant: platform_organizations, platform_org_memberships, platform_workspace_memberships, funis, ownership de conversa e regras transacionais, sob SQL 002 existente.
- OpenFGA: autorização efetiva para operações no runtime. UMA é candidata para IAM-06 shadow, não autorização final.

Não criar tabela de usuários, passwords nem grants SQL alternativos.

## 2. Migration manual IAM-04B

Arquivo candidato: infra/postgres/bootstrap/control-iam-org-links.schema (não chamado por bootstrap/provisionamento/migrate). Rodar apenas em **PostgreSQL 17 descartável** enquanto o Product Gate não liberar qualquer operação.

Tabelas public.platform_keycloak_org_links e public.platform_keycloak_org_link_audit:
- PK (tenant_id, organization_id) e UNIQUE (realm, keycloak_organization_id); FK tenant_id -> tenant_registry com RESTRICT; IDs nunca derivados de nomes/domínios.
- state active/revoked, revision positiva, carimbo temporal; audit append-only por role comum, request UUID única, fingerprint de payload, ator/motivo e transição.
- role NOLOGIN syndes_iam_link_operator: somente EXECUTE da função SECURITY DEFINER transition_platform_keycloak_org_link; jamais INSERT/UPDATE/DELETE direto. syndes_core: somente SELECT da tabela de link; sem auditoria e sem permissão de escrita.
- serialização por locks transacionais de par platform e realm+Keycloak, unicidades contra remap cross-tenant, expected_revision CAS, replay idempotente com request_id e rejeição de replay obsoleto.
- admissão da função exige tenant ativo para conceder; revogação continua permitida durante suspensão.

**Limite estrutural:** a organização reside no banco tenant, logo não existe FK cross-database. Um operador/serviço com privilégio verificado deve confirmar, **antes da escrita**, que (tenant_id, organization_id) existe, está ativo e pertence ao banco tenant correto. A função Control não é um endpoint de autoprovicionamento nem valida esse predicado interbancos. O serviço operador de provisionamento completo ainda é pendência de integração.

Read adapter PgOrganizationIdentityLinks usa dois SELECTs parametrizados, sem LIMIT 1, e exige tenant ativo; corrupção, colisão e divergência são negadas pelo resolvedor existente.

## 3. Membership Keycloak IAM-05B

Arquivo: apps/core-host/src/iam-organization-adapters.ts.

- KeycloakServiceAccountTokens: confidential client_credentials de segredo em arquivo protegido; HTTPS obrigatório fora de localhost descartável; sem bootstrap admin ou token do browser.
- KeycloakOrganizationMembershipReader: consulta GET /admin/realms/{realm}/organizations/{organization_uuid}/members/{subject_uuid} da **API oficial de administração**; roles de leitura mínimas para 26.8.1: realm-management/view-users + view-organizations no service account, fullScopeAllowed=false e scope mapping explícito.
- Uma resposta 200 só admite member id correspondente e enabled=true. 404 nega; 403, 500, redirect, JSON malformado, indisponibilidade e timeout lançam erro e a admissão nega.
- Cada verificação busca membership atual, sem cache de claims de organization ou token antigo como substitutos; não devolve PII ou segredo nas exceções. Serviço sem privilégio de administração do realm e sem uso de admin token no frontend.
- A prova do privilégio mínimo do endpoint na 26.8.1 deve ser **observada no job Keycloak real**, não presumida a partir de uma interface mockada.

## 4. Caminho de admissão (ainda isolado)

OrganizationContextAdmissionPilot recebe, por injeção trusted, o PgOrganizationIdentityLinks e KeycloakOrganizationMembershipReader. Ordem:
1. ID/capability validada; bearer assinado verificado pelo ActorVerifier (issuer, audience, azp, subject); token Platform Manager rejeitado.
2. Tenant membership ativa via Control e módulo instalado ENABLED/entitled.
3. Associação recíproca e única no Control e membership atual Keycloak.
4. Tenant DB fixado pelo servidor; org/workspace SQL active, SQL 002/backfill, role de escrita, funil owner; endpoint específico ainda deve conferir ownership da conversa, transferência/atribuição e outras regras transacionais.
5. Só então o kernel pede grants operacionais ao OpenFGA, que continua decisor. **O piloto não se conecta a main.ts nem substitui o gate de controllers.** Sem resposta positiva do OpenFGA, a operação permanece negada, mesmo com UMA positiva.

Os ports reais têm testes unitários mockados. O teste PG17 usa a associação real e injeta a membership Keycloak e outras fontes sintéticas para provar a admissão/revogação; o job Keycloak real testa separadamente service token e membership revogada. **Não chamar esses dois ensaios de E2E único com ActorVerifier+Control+tenant DB+OpenFGA reais.**

## 5. Ensaios e pipeline

- apps/core-host/test/iam-organization-adapters.test.mjs: URL/realm/token, deny 404/403/500/redirect/timeout, subject mismatch/disabled, Control rows divergentes, ausência de LIMIT, client_credentials de arquivo sem log.
- apps/core-host/test/iam-organization-links-pg17.test.mjs: PG17 descartável, repetição da DDL, ACL, N orgs por tenant, tenant B versus A, mapping 1:1, concorrência, idempotência, auditoria, CAS e revogação com sessão simulada.
- scripts/ci/run-suite.sh, suite host: inicia PG17 efêmero preso ao loopback, variável de proteção IAM04B_PG17_ONLY e password somente CI; sem schema no banco real.
- tests/platform/keycloak-organizations-authz-ci.mjs, job keycloak-real-jwt existente: Keycloak 26.8.1 em loopback; adiciona service account específico view-users + view-organizations e valida membership (200/404) antes/depois da revogação, mantendo teste UMA IAM-03.

Comprovação: run 44236143477 concluiu 24/24 jobs aprovados em SHA 36765f4506319d611c7664626bf2b1152d6d6857; `host` executou PG17 realmente (marcador IAM04B_DISPOSABLE_PG17_ACL_CONCURRENCY_AUDIT_PASS), `keycloak-real-jwt` consultou memberships e testou revogação. O primeiro ensaio `view-users` isoladamente negou com HTTP 403; foi corrigido com `view-organizations`, sem `manage-realm`. O fluxo fim a fim de produção continua pendente.

## 6. IAM-06 — entrada e shadow mode futuro

Próximo incremento, somente após CI das portas reais:
- comparar, para o mesmo actor verificado/tenant/org/workspace/funil, a decisão FGA efetiva com UMA via recurso+scope registrado;
- emitir somente métricas de divergência por categoria (agree-allow, agree-deny, FGA-allow/UMA-deny, FGA-deny/UMA-allow, provider-error), sem JWT, org comercial, PII nem conteúdo;
- execução shadow nunca concede acesso nem troca o resultado do FGA; timeout/circuit-breaker impede degradação da ação principal;
- testar SSE, funil, claim/transfer e workers com service grant à parte; definir SLA, baseline de performance, recovery/rollback e análise de divergências;
- OpenFGA (models/tuples/service grants) segue intacto até Product Gate IAM-09.

## 7. Impedimentos de Product Gate

Acesso operacional (main.ts, controllers e worker) não foi ativado; SQL002 impede múltiplas orgs/workspaces em tenant operacional; não há backing operacional migrado, backup/restore homologado, grants fino por operação, ownership transacional de todos fluxos, token real combinado Control+SQL+FGA nem teste de SSE/revogação atômica. Keycloak Org Group não é automaticamente Group Policy de Authorization Services.

**CD preflight separado:** run 44229567880, job tailnet-preflight 134550997742. OIDC Tailnet, peer e Tailscale SSH passaram. Falhou em "Verify locked four-file Compose contract remotely without writes", saída "Core Host Compose service missing", exit 3. Jobs provision-homolog-identity e deploy foram pulados. Isso é divergência de Compose/service remoto a investigar exclusivamente pelo workflow de CD, sem contornar os controles nem executar deploy manual.

## 8. Evidência de PR, sem homologação

- [PR #164](https://github.com/delmacy/syndes-system/pull/164) — merged; [CI 24/24](https://github.com/delmacy/syndes-system/actions/runs/44236143477).
- [Merge](https://github.com/delmacy/syndes-system/commit/b42038f01aabf154c975a345f22a64e1bdfbaf44).
- API Admin Organizations exige papel de leitura `view-organizations` além da visibilidade `view-users`; ambos são realm-level e não provam menor privilégio **por organização**. FGAP/filtragem adicional é gate de IAM-07/IAM-09 antes de promover service credentials reais.
- Não houve deploy de IAM nem migration no banco operacional. O CD permanece controlado por aprovação explícita do SHA e seus preflights.
