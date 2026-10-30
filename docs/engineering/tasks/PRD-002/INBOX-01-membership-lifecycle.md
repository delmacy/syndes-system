# INBOX-01 — Membership de atendentes

- **Módulo/gate:** Inbox / Sprint 1 prerequisite.
- **Classificação:** `MVP` (prerequisito para atribuição e operação por múltiplos atendentes).
- **Owner:** OpenCode Free com provider NVIDIA disponível; Codex revisa.
- **Dependência:** Sprint 0 spec/contrato congelados.

## Objetivo

Permitir ao `tenant_admin` associar ao tenant uma identidade `actor` que já exista no Control Plane e revogar seu membership quando necessário. Não criar conta, senha, convite ou identidade no Keycloak.

## Escopo permitido

- `apps/api/src/modules/core-crm/memberships/**` e wiring/testes diretos desta controller.
- Testes unitários/contract existentes do membership e teste de integração PostgreSQL adequado.
- Reusar `TenantMembershipService.grantMember`/`revokeMember`; modificar o serviço apenas se necessário para contrato e audit definidos.

## Não tocar

Inbox conversation schema/API; `apps/web/**`; configuração Keycloak/IdP; schema de outra tabela; papéis customizados; provisionamento de actor.

## Resultado/contrato

- `GET /api/v1/crm/memberships` continua listado somente por `tenant_admin`.
- `POST /api/v1/crm/memberships` recebe `{ actorId, customerScope }`, aceita somente actor existente, cria `tenant_member` ativo e audita no Control Plane.
- `DELETE /api/v1/crm/memberships/:actorId` revoga membership ativo de `tenant_member`, com auditoria.
- `PUT /api/v1/crm/memberships/:actorId/scope` mantém escopos `cpf|pj|both` e regras existentes.
- Sem membership ativo, o usuário não acessa dados tenant nem pode ser atribuído a conversation.

## Aceite e evidência

- Unit/contract tests para actor inválido/inexistente, body malformado/campo extra, member/admin authorization, duplicidade, revogação repetida e scope inválido.
- PostgreSQL integration prova concessão/revogação e auditoria transacional; prova que actor de tenant A não ganha acesso ao tenant B sem concessão explícita.
- Lint, typecheck, testes relevantes e build API passam. Registrar comandos/resultados e arquivos modificados.
- Não executar Playwright nesta task.
