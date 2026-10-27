# CRM-03 — Identity, autorização, TenantContext, routing e audit

- **Módulo/gate:** Platform Core mínimo / Sprint 1.
- **Classificação:** MVP.
- **Prioridade/estado:** P0 / **ACEITO para integração**, após revisão do diff e CI verde.
- **Responsável:** Codex coordinator; contribuições delegadas e revisadas de OpenCode (API) e Cursor (web).
- **Issue/branch/commit/PR:** branch `work/prd-001-core-crm-sprint-0`; commits `6267840`, `ef2381c`, `20ecc5e`; sem PR criado.

## Objetivo

Aplicar a sessão/autenticação aprovada para derivar actor e tenant server-side, autorizar cada uso e rotear dados apenas ao database do tenant permitido. Emitir audit events para mudanças críticas.

## Incluído

- Implementar os contratos `AuthenticatedActor`, membership, role/permissions e `TenantContext` conforme decisão CRM-00.
- Bootstrap the minimal Next.js App Router auth shell and server-side BFF with the Auth.js Keycloak OIDC provider using Authorization Code + PKCE; keep tokens server-side, set a Secure/HttpOnly/SameSite=Lax host-only session cookie, and clear the app and Keycloak sessions on logout. This is auth infrastructure only: no product pages, visual design, or CRM/manager UI.
- Validate Keycloak access tokens using JWKS and a maintained JWT library: exact `iss`, API `aud`, allowed `azp`, signature, `exp`, `nbf`, and `sub`; platform-manager requests also require `acr=mfa`. Do not implement cryptography/JWT parsing manually.
- Map `(issuer, sub)` to permanent local `AuthenticatedActor.id`; email is not an identity key. Control Plane membership and permissions are authoritative; do not trust tenant or product-role claims from Keycloak.
- Enforce MFA in Keycloak through the configured ACR `mfa` requested by the manager BFF and validated by the API. Tenant-member MFA follows the operator-configurable realm policy. Keycloak realm SSO is in scope; per-tenant external SAML/OIDC federation is post-MVP.
- Derive `TenantContext` from ingress-validated hostname mapping and active Control Plane membership. Reject tenant/database selectors from body, query, and client-controlled headers; validate the API audience and enforce manager-only MFA/role checks separately from tenant membership.
- Guards/policies: `platform_admin` may use manager routes only and never gains CRM access; `tenant_admin` has approved CRM permissions including archive/export; `tenant_member` may read/create/update but not archive/export. Default deny.
- Store fixed `customer_scope` (`cpf`, `pj`, `both`) on each tenant membership in Control Plane. `tenant_admin` can update member scopes only inside its tenant; admins remain `both`.
- Expose the minimal tenant-scoped membership/scope management contract used by CRM settings; audit each grant/revoke/scope change. This is fixed authorization metadata, not a generic permission engine.
- Resolver/acquirir/fechar conexões tenant com métricas/limites definidos por medição, sem conectar ao Control Plane com credenciais de tenant.
- Auditoria para create/provision tenant e operações CRM críticas, sem secrets/PII desnecessária.
- Unit/integration tests for invalid sessions, roles/scopes, forged tenant/record IDs, out-of-scope reads/writes, timeout, and wrong tenant connection.

## Excluído

- Federação SAML/SCIM, policy language genérica, auth para módulos futuros, privilégios de suporte que leem CRM.
- Configurar contas externas/segredos sem autorização.

## Dependências/ownership

- Depende de CRM-00 e CRM-02.
- Permitidos: contracts/providers/guards/interceptors/audit/connection resolution de `apps/api/src/modules/platform-core/**`; testes; documentação direta; e o shell `apps/web/**` estritamente necessário ao Auth.js BFF, incluindo configuração, rota de callback, sessão e logout.
- Proibidos: páginas/UX de produto, controllers CRM (CRM-05+), telas de Platform Admin ou Core CRM, alteração de auth decision, tenant schema sem ordem de mudança.
- Contratos produzidos devem exportar só a API Nest necessária a `core-crm`; registrar consumidores.

## Critérios de aceite e validação

- Sem sessão válida, endpoints protegidos não retornam conteúdo.
- Actor/tenant vêm da identidade validada e registro trusted; headers/query/body adulterados não trocam tenant.
- Tenant B não lê/escreve dados ou IDs de A; negative tests provam 404 e ausência de troca de tenant por selectors adulterados.
- Platform Admin não possui acesso implícito a records tenant.
- Audit contém actor/action/tenant/time/result segundo política, sem tokens/passwords/secrets.
- Integration tests rodam contra DB descartável; não executar E2E frontend.

## Execução desta tentativa

- OpenCode concluiu a revisão/implementação backend em `apps/api/**`; Cursor concluiu a infraestrutura web em `apps/web/**`. Ambos tiveram ownership exclusivo, entregaram relatórios e foram liberados. Codex integrou seletores de tenant no BFF/API, CI web e o ajuste SQL após a primeira rodada do Actions.
- A revisão do OpenCode corrigiu o uso dos nomes canônicos de database/role tenant no pool e tornou `exp` obrigatório no verificador JWT. A revisão do Cursor implementou o BFF Auth.js/Keycloak e testes dos helpers.
- Nenhum tenant secret provider foi inventado: leitura/escrita de credenciais continua fail-closed até binding de deployment aprovado.
- A resolução de host exige assinatura HMAC recente emitida pelo BFF e membership ativa no Control Plane. Deployment deve manter API privada ao BFF/ingress, sobrescrever headers `x-syndes-validated-*` recebidos do cliente, configurar o mesmo `INGRESS_SIGNING_SECRET` no BFF e API, e habilitar TLS.
- Seletores de tenant/database no header, query ou body são rejeitados no BFF e no guard da API; o roteamento só aceita a asserção HMAC do BFF e confirma membership ativa.
- Configuração obrigatória de API: `KEYCLOAK_ISSUER`, `KEYCLOAK_API_AUDIENCE`, `KEYCLOAK_ALLOWED_AZP`, `INGRESS_SIGNING_SECRET`, `TENANT_DATABASE_HOST`, `TENANT_DATABASE_PORT`, `TENANT_DATABASE_SSL_REQUIRED=true`, `TENANT_DB_POOL_SIZE` e `TENANT_DB_POOL_LIMIT`. Valores de pool devem vir de medição do ambiente; não há defaults numéricos.
- Configuração obrigatória do web BFF: `AUTH_SECRET`, `AUTH_URL`, `KEYCLOAK_ISSUER`, `KEYCLOAK_WEB_CLIENT_ID`, `KEYCLOAK_WEB_CLIENT_SECRET`, `SYNDES_API_URL` e `INGRESS_SIGNING_SECRET`. Segredos devem ser provisionados pelo ambiente, nunca versionados.
- Validação local no commit final: API 83/83 unit tests, lint, typecheck e build; web 11/11 unit tests, lint, typecheck e build; `npm audit` sem vulnerabilidades nos dois apps; `git diff --check` limpo. PostgreSQL 16 migrations/integration foram executadas no GitHub Actions; E2E não foi executado conforme instrução.
- GitHub Actions no commit `20ecc5e`: `API` run [40539707820](https://github.com/delmacy/syndes-system/actions/runs/40539707820) passou (inclui PostgreSQL 16, migrations Control Plane e tenant); `Repository Integrity` run [40539707853](https://github.com/delmacy/syndes-system/actions/runs/40539707853) passou. O job `apps/web CI` também passou no run `40539707820`.
- A primeira rodada de integração revelou conflito UUID/text no `resource_id` de `audit_events`; corrigido em `20ecc5e` e provado pela integração verde subsequente. A rodada final está verde.
- Limites de prova: sem realm/credenciais Keycloak de deployment, login e entrega real de `acr=mfa` não foram executados; sem provider de secrets configurado, o binding padrão continua fail-closed. São pré-requisitos explícitos de deployment, não configuração versionada nesta task.
- Revisão independente do Cursor e respectivos resultados estão em [CRM-03-web-auth-review.md](CRM-03-web-auth-review.md).
- **Decisão:** ACEITO para integração no branch, com os pré-requisitos de deployment acima registrados. A task dependente CRM-04 também foi ACEITA após validação no Actions; o gate geral do Core CRM permanece aberto para as próximas sprints e CRM-11.

## Encerramento

- Evidência inclui matriz role/action/decision e testes; sequência de Sprint 1 concluída com CRM-04, próxima ordem é CRM-05 na Sprint 2.
