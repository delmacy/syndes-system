# Syndes Operations — DC-2: funções administrativas da conta contratante

**Data:** 2026-11-09
**Estado:** incremento de código e testes em branch isolada; **não implantado**.
**Issue:** #49. **Dependências:** #31 (Product Gate), #21 (isolamento Organization/Workspace), #32 (Support), PR #33 (Platform Manager).
**Base:** `integration/workspace-org-crm-c2-20261109`. Não usar o checkout operacional do DevServer01.

## Objetivo e distinções

O produto terá dois contextos de atuação para o proprietário da fornecedora: **Platform Manager** (Control Plane, administração global de metadados) e **Workspace operacional da própria Syndes** (tenant comum, CRM/Inbox/Support/funcionários pelos mesmos módulos dos demais clientes). A conta contratante precisa ainda ter um responsável e administradores delegados sem que esses papéis sejam confundidos com proprietários da plataforma.

Este incremento introduz apenas o **fundamento de titularidade da conta contratante**, sem migrar tenants reais, criar usuários, habilitar telas, vincular automaticamente a única identidade do Keycloak ou conceder acesso ao CRM/Inbox. Nunca registrar o tenant Syndes como supertenant.

## Escopo implementado

1. Migração aditiva e **manual** `infra/postgres/bootstrap/control-account-roles.schema`, aplicada em `syndes_control` após `control.schema`, criando:
   - `tenant_account_role_grants`: `tenant_id`, `principal_id`, `role = owner|admin`, `state = active|revoked`, `granted_by`, `updated_by` e timestamps;
   - `tenant_account_role_audit`: trilha de concessão, mudança de papel, revogação e reativação;
   - triggers para membership ativo na concessão, identidade de grant imutável, proteção do último owner ativo e auditoria automática.
2. **Nenhum grant é criado pelo schema.** Role `syndes_core` e `PUBLIC` não recebem nem SELECT nem DML nas tabelas novas, até existir serviço de autorização revisado. A operação de grant é exclusiva de um operador de banco aprovado nesta etapa. Funções de trigger não são disponíveis para chamada direta por `PUBLIC`.
3. `packages/core-kernel/src/account-roles.ts` define o predicado `accountRolePermits`, capaz de reconhecer owner/admin de conta **somente quando** o ator, o tenant, a membership ativa e o grant ativo coincidem. O predicado é **uma elegibilidade**, não substitui JWT, `CoreKernel.execute`, OpenFGA ou autorização do recurso.
4. Regressões de kernel e `tests/platform/account-roles-pg-smoke.sh` cobrem dois tenants, papéis independentes, negação de uso cruzado, membership revogada, auditoria, proteção do último owner, bloqueio de DML pelo serviço e reaplicação idempotente do SQL.

**Importantíssimo:** a tabela `tenant_memberships` existente continua sendo a membership básica; ela não virou uma role. A tabela `platform_operator_access` do Platform Manager vive no Control DB, mas continua independente e não produz novos account grants.

## Matriz de capacidades proposta para o contrato de conta

| Capacidade | Account Owner | Account Admin | Org Admin | Workspace Manager | Atendente |
| --- | --- | --- | --- | --- | --- |
| `account.profile.read` | Sim | Sim | Não por esta role | Não | Não |
| `account.profile.manage` | Sim | Sim | Não por esta role | Não | Não |
| `account.members.read` | Sim | Sim | Não por esta role | Não | Não |
| `account.members.manage` | Sim | Sim | Não por esta role | Não | Não |
| `account.roles.manage` | Sim | Não | Não | Não | Não |
| `account.billing.read` | Sim | Não | Não | Não | Não |
| CRM/Inbox/Support/RH | **Sem acesso implícito** | **Sem acesso implícito** | Somente grants operacionais | Somente grants operacionais | Somente grants operacionais |

As capacidades acima são contratos de domínio para autorização futura, **não APIs de gestão nem telas já implantadas**. Não implementar permissões de conta comparando simplesmente strings `isAdmin` ou `isMaster` no frontend. Se um Account Owner também quiser atender clientes, precisa dos vínculos normais de Organization/Workspace e das permissões OpenFGA correspondentes.

## Invariantes de autorização

- Um grant de account é único por `(tenant_id, principal_id)`, referenciando membership existente; inserir grant ativo exige a membership ativa.
- Mesmo se a membership original for posteriormente revogada, o backend só poderá aceitar um grant pela junção **em tempo real** `tenant_account_role_grants g JOIN tenant_memberships m USING(tenant_id,principal_id)` com ambos `state='active'`. Jamais usar somente o registro de grant.
- A revogação de owner exige outro **owner ativo com membership ativa** no mesmo tenant. A trava por tenant serializa transições e impede deixar a conta sem titular por uma transição de papel comum; uma revogação de membership feita por mecanismo legado ainda pode remover acesso efetivo e exige Product Gate na integração.
- `owner` pode ser delegado a pessoas diferentes se aprovadas; administradores não podem transferir titularidade por conta própria. A tabela não possui API de grant nesta entrega; a delegação autenticada exige fluxo auditado futuro.
- Contas de clientes não herdam roles da conta Syndes e não podem chegar aos dados do provedor por conterem contatos/tickets no atendimento da fornecedora.
- Não fazer migração deste schema no tenant DB. `platform_org_memberships`/`platform_workspace_memberships` mantêm `admin/editor/viewer` até incremento próprio. Supervisor/atendente são atribuições operacionais, não aliases automáticos do Account Owner.

## Próximos incrementos, com gates

- **DC-2a — concluído como código, CI pendente até aprovação:** schema + contrato de capabilities + regressões.
- **DC-2b — pendente:** endpoint/serviço de administração de membros com autenticação, OpenFGA, SQL parametrizado, controle de concorrência, consentimento, auditoria de identidade, política de concessão, desativação e transferência de owner. Nunca expor acesso de escrita direto à role runtime.
- **DC-2c — pendente:** migração deliberada de perfis de Organization/Workspace, equipes e vínculo `principal_id` ↔ colaborador CRM, com negações cross-org e cross-workspace.
- **DC-3 — pendente:** provisionar a conta operacional da própria Syndes por procedimento comum, não reutilizar o tenant de demonstração; Product Gate #31, backup, rollback, aprovação do responsável e preservação de SQL 002.
- **DC-4..8:** navegação dual com OIDC separado, gestão de colaboradores, Support interno/externo (#32), eventual `Support Access Grant` com escopo/TTL/aprovação, testes E2E e release.

## Execução e rollback

Para CI descartável: `npm test` em `packages/core-kernel`, e `bash tests/platform/account-roles-pg-smoke.sh` em host Linux com Docker. Esse smoke sobe e remove **seu próprio** PostgreSQL com rede `none`, não usa o Control DB operacional. O workflow `core-host-infra.yml` executa a prova com PG descartável.

**Não executar a migração manual no DevServer01** antes da aprovação. Rollback de código é possível por reversão da PR; como não há dados persistidos na entrega de código, não é necessário DROP de tabelas em produção. Em rollout real com novos grants, tabelas/auditoria devem permanecer para histórico; nunca usar `DROP ... CASCADE` como rollback de segurança. A revisão de migrations e backup/restauração precedem implantação.
