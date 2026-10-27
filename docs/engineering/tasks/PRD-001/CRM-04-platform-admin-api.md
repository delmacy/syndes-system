# CRM-04 — API manager de tenants

- **Módulo/gate:** Platform Core mínimo / Sprint 1.
- **Classificação:** MVP.
- **Prioridade/estado:** P0 / depende de CRM-03.
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
- Create/retry idempotente com estado observável, input inválido rejeitado, erros sem stack/secret.
- Integration/contract tests mais unit/lint/typecheck/build pertinentes passam; não executar frontend E2E.
- Próximo owner: Codex revisão; aceita Platform Core gate antes de CRM-05/09.
