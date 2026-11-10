# F0 — Inventário inicial de SQL e fronteiras de módulos

**Data:** 2026-11-10 • **Baseline:** `afe057aa` • **Tarefas:** AK-00.01 (parcial), AK-10.01 (primeira fatia). **Tipo:** inspeção estática, sem banco runtime.
A lista de tabelas resulta da busca por `CREATE TABLE` nos arquivos SQL versionados e **não inclui necessariamente tabelas auxiliares feitas por SQL dinâmico, tabelas já presentes nos bancos, triggers, funções ou views**. É necessário completar inventário de `ALTER TABLE`, FKs, functions, grants, code SQL e Go antes da conversão física.

| Proprietário | Arquivos SQL inspecionados | Tabelas explicitamente criadas; alvo |
| --- | --- | --- |
| Organizations | `modules/organizations/sql/001..007` | `platform_organizations`, `platform_org_memberships`, `platform_workspaces`, `platform_workspace_memberships`, `platform_units`, `platform_workspace_units`, `platform_org_audit`, `platform_legacy_backfill_runs`, `platform_staff_identity_links`, `platform_workspace_staff_roles`, `platform_staff_teams`, `platform_staff_team_workspaces`, `platform_staff_team_members`, `platform_staff_access_audit` → `organizations.*`. |
| CRM | `modules/core-crm/sql/001..003` | `crm_organizations`, `crm_people`, `crm_person_organizations`, `crm_audit`, `crm_tags`, `crm_person_tags`, `crm_notes`, `crm_employees`, `crm_channel_identities` → `crm.*`. |
| Inbox | `modules/inbox/sql/001` | `inbox_conversations`, `inbox_messages`, `inbox_events` → `inbox.*`. |
| WhatsApp | `modules/whatsapp/sql/001..007` | `whatsapp_accounts`, `whatsapp_outbox`, `whatsapp_outbound_send_windows`, `whatsapp_inbound_events`, `whatsapp_conversation_routes`, `whatsapp_contact_name_changes`, `whatsapp_contact_name_labels`, `whatsapp_delivery_receipts` → `whatsapp.*`. |
| Support | `modules/support/sql/001` | `support_queues`, `support_queue_memberships`, `support_queue_membership_audit`, `support_cases`, `support_case_events` → `support.*`; somente tenant operacional Syndes por contrato vigente. |

## Dependências e riscos observados

- **Control DB não é schema do tenant:** `tenant_registry`, `tenant_memberships`, `tenant_account_role_grants`, `platform_operator_access` e seus registros mantêm isolamento próprio. Não mover para `organizations` do tenant.
- **Organizations migration 002:** índices de single-context são dependências de consultas de guard/escopo; qualificar objetos e consultar `pg_indexes` corretamente antes de reescrever. Não retirar o gate multi-org por refatoração de schema.
- **Organizations migrations 003–007:** alterações cross-module em CRM, Inbox e WhatsApp; um schema por proprietário requer distribuir DDL de modo coerente ou uma migration de integração explicitamente dependente.
- **CRM ↔ Inbox:** `inbox_conversations` tem ligação com pessoa canônica; FKs precisam se tornar cross-schema e preservar chaves tenant-qualified.
- **WhatsApp ↔ Inbox/Organizations:** worker, gateway Go e owner/route guards precisam usar identidades e nomes qualificados depois da migração.
- **Support:** instalar apenas no tenant Syndes; novo catálogo não pode accidentalmente criar schema `support` em todos os tenants.
- **Runtime:** `TenantPgProvider` usa a mesma role e pool por tenant para módulos; schema próprio não garante acesso SQL diferenciado. Separação de roles/grants fica para AK-30.03.
- **Instalador atual:** `migrate-modules-tenant.sh` aplica migrations de todas as plugins presentes no build (salvo Support); sem consulta de entitlement por tenant ou ledger checksum genérico.
- **Nenhum dado operacional foi lido nesta fase.** O inventário de DevServer01 e prova de backup ficam pendentes AK-00.02.

## Primeira implementação entregue neste ramo

- `ModuleDefinition.schema?` permite declarar propriedade de schema sem alterar módulos legados; o registry rejeita schemas reservados, nomes inválidos e colisão de proprietários.
- `ModuleAccessPort`, `requireModuleAccess` e `CoreKernel.executeModule` criam caminho **fail-closed**, exigindo membership e FGA existentes mais decisão positiva do módulo.
- `execute` permanece compatível para os módulos atuais: **não afirma que os módulos existentes já verificam entitlement**.
- Testes do Kernel: 22/22; nenhum acesso ao banco e nenhuma mudança de infraestrutura.
- **Próxima fatia obrigatória:** o catálogo persistente + adapter do Control Plane, migrations e testes PG17 A/B; somente depois migrar controllers/workers para `executeModule` com cobertura de regressão.

## Conclusão F0

Inventário de `CREATE TABLE` concluído **parcialmente**. **AK-00.01 continua PEND** até mapear integralmente funções, views, triggers, constraints, PostgreSQL e Go. A próxima migração de schema deve ser em banco descartável, um módulo por vez, depois do gate de catálogo/entitlement.
