# CRM-04 — API manager de tenants

- **Módulo/gate:** Platform Core mínimo / Sprint 1.
- **Classificação:** MVP.
- **Prioridade/estado:** P0 / implementação em revisão; aguarda prova CI da integração PostgreSQL.
- **Responsável recomendado:** OpenCode Free; Codex revisa.
- **Issue/branch/commit/PR:** ainda não criados; esta é uma ordem local, sem operação externa.

## Objetivo e escopo

Implementar API autenticada para listar/ver metadados de tenant, criar tenant com ID permanente, iniciar/repetir provisioning idempotente e editar apenas metadados permitidos.

## Incluído

- DTO validation, backend authorization, `/api/v1`, RFC 9457 Problem Details, and minimal pagination per CRM-00.
- Platform Admin manages tenant metadata/provisioning only; it cannot list or access tenant CRM records. Tenant membership roles are not Keycloak roles.
- Allow Platform Admin to assign the initial `tenant_admin` membership by exact configured Keycloak issuer/subject for a tenant; this access metadata grants no Platform Admin CRM access.
- Initial Keycloak user creation remains an operator runbook until Onboarding; do not add email invitations or tenant federation.
- Nunca retornar connection strings, credentials ou conteúdo de banco tenant.
- Unit/integration/contract tests para roles, validação, idempotência, erros e ausência de data access CRM.
- Documentar endpoints no formato/versionamento aprovado.

## Excluído

- UI (CRM-09), billing, suspender/deletar tenant, busca/export CRM, impersonation, endpoints não autenticados.

## Dependências e ownership

- Depende de CRM-03 e CRM-02.
- Permitidos: controller/service/dto/tests em `apps/api/src/modules/platform-core/manager/**`, módulo imports mínimos e API docs.
- Proibidos: `core-crm/**`, `apps/web/**`, conexão direta do manager com tenant DB, alteração do contrato auth.
- Consome provisioning, registry e authorization contracts aprovados.

## Aceite/testes/evidência

- Platform Admin permitido; tenant member negado conforme matriz; nenhum secret/CRM content em resposta.
- Provisioning start/retry idempotente com estado observável; input inválido rejeitado; erros sem stack/secret.
- Integration/contract tests mais unit/lint/typecheck/build pertinentes passam; não executar frontend E2E.
- Próximo owner: Codex revisão; aceita Platform Core gate antes de CRM-05/09.

## Evidência de implementação (2026-10-27)

Módulo: `apps/api/src/modules/platform-core/manager/` (ManagerModule registrado em `app.module.ts`).

### Endpoints (controller path `api/v1/platform-admin/tenants`, todos `@UseGuards(PlatformAdminGuard)`)

- `GET /api/v1/platform-admin/tenants?page={n}&pageSize={n}` — lista paginada (`page`, `pageSize`, `total`, `items[]` com `id`, `displayName`, `provisioningState`, `createdAt`, `updatedAt`); default `pageSize=20`, máx. 100.
- `POST /api/v1/platform-admin/tenants` — cria tenant com UUID permanente gerado server-side; `database_name` derivado como `sdb_<uuid-sem-hifens>` e nunca retornado em nenhuma resposta (nem `tapp_<uuid>`).
- `PATCH /api/v1/platform-admin/tenants/:tenantId` — edita apenas metadados aprovados (`displayName`); campos desconhecidos (`tenant_id`, `database_name`, etc.) → 400 `validation_failed` com `unknown_field`.
- `GET /api/v1/platform-admin/tenants/:tenantId` — detalhe (mesmos campos da lista mais `provisioning` quando existir); sem campos CRM/`visibleForAdmin`.
- `POST /api/v1/platform-admin/tenants/:tenantId/provisioning` (HttpCode 200) — start/retry único e idempotente, delega a `TenantProvisioningService.provision()` (CRM-02); não-ready → 409. Tentativas em estado `ready` são no-ops que repetem a mesma observação sem incrementar `attempt`.
- `POST /api/v1/platform-admin/tenants/:tenantId/initial-admin-membership` — atribui membership `tenant_admin` inicial resolvendo um `identity_actors` row EXISTENTE por issuer+subject exatos contra o `readIdentityConfig().issuer` configurado.

### Contrato de erros (RFC 9457)

- `ManagerProblemDetailsFilter` registrado globalmente via `APP_FILTER`; captura inclusive exceções dos guards (401/403) e 404 de rota.
- Erros com payload estruturado estável (`code`, `requestId`, `errors[]` com `field`/`rule`, extras seguros como `stage`/`failureCode`); toda outra exceção HttpException/erro desconhecido é sanitizada para apenas status+title — sem stack, sem segredos; erros desconhecidos são logados sem `message`.
- Mapeamento: não autenticado → 401 `unauthorized`; acr != mfa ou não-platform-admin → 403 `forbidden`; tenant UUID válido inexistente → 404 `tenant_not_found`; `tenantId` malformado → 400 `validation_failed`/`invalid_format`; rota errada → 404 `not_found`.
- Validadores manuais em `manager-dtos.ts` (sem class-validator/class-transformer — não adicionamos dependências): displayName 1–200 chars trimmed sem caracteres de controle; subject `^[A-Za-z0-9_.~-]{1,255}$`; issuer deve ser o issuer configurado (`unconfigured_issuer`); rejeição de campos desconhecidos.

### Regras de negócio

- Assignment de admin inicial exige `provisioning_state = 'ready'` (senão 409 `tenant_not_ready`); emissor diferente do configurado → 400; actor inexistente → 404 `actor_not_found` (não cria usuário Keycloak, e-mail ou convite); membro duplicado → 409 `membership_exists` (23505 mapeado).
- Auditoria: mutações gravam `tenant.created`, `tenant.updated`, `tenant.membership.initial_admin`, `tenant.provisioning.attempt` na MESMA transação do Control Plane (rollback atômico com a mutação); provisão registra `tenant.provisioning.attempt`/`tenant.provisioning.ready` via `AuditService` não-transacional (best-effort).
- `TenantProvisioningError` → 502 `provisioning_failed` com `stage`/`failureCode` sanitizados; recuperação é feita sempre pelo mesmo endpoint de start/retry.

### Testes

- Unit/contract: `manager-dtos.spec.ts`, `manager-problem-details.spec.ts`, `manager-tenants.service.spec.ts`, `manager-tenants.controller.spec.ts` (supertest incl. shapes de 400/401/403/404 e formas de sucesso).
- Integração Postgres: `manager-tenants.controller.postgres.integration.spec.ts` — roda com Control Plane real + idempotência de provisioning + recovery pós-falha + auditoria + absence of CRM/secret leakage; roda no CI (`.github/workflows/api.yml`, Postgres descartável) e é `describe.skip` sem `CONTROL_PLANE_DATABASE_URL` no ambiente local. O override do `TENANT_SECRET_STORE` para store em memória é exclusivamente de teste/CI, não configuração de runtime.
- Verificação executada: `npm run lint`, `npm run typecheck`, `npm run test:unit` (20 suites/122 testes), `npm run build` — todos verdes em 2026-10-27; integração depende do CI.

### Limitações conhecidamente fora do escopo

- A criação do row `identity_actors` do alvo não é endpoint do manager: por contrato, o manager só resolve atores já existentes. Criá-los em produção exige runbook/Onboarding (item excluído pela ordem) — registrar como pré-requisito operacional.
