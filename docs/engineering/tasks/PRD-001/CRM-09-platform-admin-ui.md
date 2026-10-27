# CRM-09 — Frontend Platform Admin

- **Módulo/gate:** Core CRM integrated modules / Sprint 3.
- **Classificação:** MVP prerequisite.
- **Prioridade/estado:** P1 / bloqueada por CRM-00, CRM-03 e CRM-04.
- **Responsável recomendado:** Cursor Auto, uma fatia; Codex revisa.
- **Issue/branch/commit/PR:** ainda não criados; esta é uma ordem local, sem operação externa.

## Objetivo e escopo

Criar módulo Next.js `platform-admin` para listar/ver metadados, criar tenant, iniciar/repetir provisionamento e editar apenas campos aprovados.

## Incluído

- App Router compõe telas do módulo; UI consome APIs NestJS e sessão aprovada.
- Loading/empty/error/success states e validação user-facing.
- Allow Platform Admin to assign the initial `tenant_admin` membership using the exact configured Keycloak issuer/subject; do not present an invite or per-tenant SSO federation flow in MVP.
- Component tests para fluxos/form states e contract tests se suportados no pacote.
- Garantir que resposta/UI não apresenta secrets, connection details ou dados CRM.

## Excluído

- Login/auth novo em frontend, acesso a tenant DB, CRM screens, billing, suspensão/deleção, regras de autorização duplicadas.

## Dependências/ownership

- Depende de contratos CRM-00, guards/API CRM-03/04 e Next shell approved.
- Permitidos: `apps/web/src/modules/platform-admin/**`, suas rotas de composição e seus testes; não editar contracts backend.
- Proibidos: `core-crm/**`, `apps/api/**`, design-system genérico não exigido pelo fluxo, módulos futuros.

## Aceite/evidência

- Platform Admin workflow funciona via API e é testado; usuário tenant sem papel adequado é negado pela API e UI comunica erro.
- UI exibe somente metadados/estado; nenhuma regra de segurança depende de esconder botões.
- Testes de componente executados. Frontend E2E apontado, mas não executado por padrão; se autorizado, Playwright headless e output analisado.
- Próximo owner: Codex review; depois CRM-10.
