# CRM-03 — Identity, autorização, TenantContext, routing e audit

- **Módulo/gate:** Platform Core mínimo / Sprint 1.
- **Classificação:** MVP.
- **Prioridade/estado:** P0 / bloqueada por CRM-00 e CRM-02.
- **Responsável recomendado:** OpenCode Free, uma dispatch mutável; Codex revisa security.
- **Issue/branch/commit/PR:** ainda não criados; esta é uma ordem local, sem operação externa.

## Objetivo

Aplicar a sessão/autenticação aprovada para derivar actor e tenant server-side, autorizar cada uso e rotear dados apenas ao database do tenant permitido. Emitir audit events para mudanças críticas.

## Incluído

- Implementar os contratos `AuthenticatedActor`, membership, role/permissions e `TenantContext` conforme decisão CRM-00.
- Next.js server-side BFF uses the Auth.js Keycloak OIDC provider with Authorization Code + PKCE; keep tokens server-side, set a Secure/HttpOnly/SameSite=Lax host-only session cookie, and clear the app and Keycloak sessions on logout.
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
- Permitidos: contracts/providers/guards/interceptors/audit/connection resolution de `apps/api/src/modules/platform-core/**`, testes e documentação direta.
- Proibidos: controllers CRM (CRM-05+), frontend, alteração de auth decision, tenant schema sem ordem de mudança.
- Contratos produzidos devem exportar só a API Nest necessária a `core-crm`; registrar consumidores.

## Critérios de aceite e validação

- Sem sessão válida, endpoints protegidos não retornam conteúdo.
- Actor/tenant vêm da identidade validada e registro trusted; headers/query/body adulterados não trocam tenant.
- Tenant B não lê/escreve dados ou IDs de A; negative tests provam 404 e ausência de troca de tenant por selectors adulterados.
- Platform Admin não possui acesso implícito a records tenant.
- Audit contém actor/action/tenant/time/result segundo política, sem tokens/passwords/secrets.
- Integration tests rodam contra DB descartável; não executar E2E frontend.

## Encerramento

- Evidência inclui matriz role/action/decision e testes; próximo owner: Codex review; em seguida CRM-04 manager API.
