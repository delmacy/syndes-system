# AK-40.01 — Organizations: inventário SQL, migração candidata e bloqueios

**Baseline:** 2026-11-10, main remoto afe057aa3028b61a0741feac71ab5b8d2ae9381e.
**Estado:** código de migração **CANDIDATO / INATIVO**, não aprovado para uso operacional.
**Arquitetura:** [PR #65](https://github.com/delmacy/syndes-system/pull/65), Core Kernel [#66](https://github.com/delmacy/syndes-system/pull/66), Metering [#67](https://github.com/delmacy/syndes-system/pull/67).
**Escopo:** Organizations; sem alterações em GitHub Actions, Platform Manager, Control Plane, banco operacional ou habilitação multi-org.

## Gates arquiteturais verificados

| Requisito | Estado no main de referência | Consequência |
| --- | --- | --- |
| Metadado de schema e ModuleAccessPort no Kernel | Apenas PR #66, **não integrada** | Host ainda não nega execução por entitlement |
| Catálogo versionado por tenant (AK-10.02) | **Ausente** | Não criar fonte de verdade paralela |
| Estados entitled/installed/enabled/suspended (AK-10.03) | **Ausentes** | Package montado não equivale a módulo habilitado |
| Installer plan/apply/verify, ledger/checksum (AK-30.01/02) | **Ausente** | Script legado ainda emite migrations de todos os plugins |
| Tenant registry confiável/DB próprio e OpenBao | Presentes no Host | Nenhum parâmetro HTTP seleciona DB, schema ou credentials |
| Keycloak/OpenFGA | Adapters existentes; gate de módulo não validado | Identidade e grants continuam autoridades independentes |
| SQL 002 e Product Gate #31 | **Ativos, gate fechado** | Ambos índices exclusivos são obrigatórios |
| Grants por schema, roles separadas por módulo | **Ausentes** | Schema próprio não é sandbox PostgreSQL até AK-30.03 |

## Inventário dos SQL 001–007

| Origem | Objetos e proteções | Destino qualificado candidato |
| --- | --- | --- |
| 001 | 7 tabelas e PK/FKs compostas; índices default/membership/unit/audit | organizations |
| 002 | 2 índices unique: platform_legacy_single_organization e platform_legacy_single_workspace | organizations, **não remover** |
| 003 | 7 FKs owner + 1 check; owner columns em CRM/Inbox/WhatsApp; 5 índices; 1 tabela backfill; 3 funções e 5 triggers | Tabela/funções em organizations; FK/triggers em crm/inbox/whatsapp |
| 004 | Preflight de owner; 1 função, 1 trigger de rota WhatsApp | Função organizations; trigger whatsapp |
| 005 | Preflight de relações; owner de canal; 4 índices; reescreve 2 funções; 4 funções e 5 triggers de integridade | Funções organizations; tabelas externas crm/inbox/whatsapp |
| 006 | Evolução de constraint/eventos da auditoria | organizations.platform_org_audit |
| 007 | 6 tabelas Workforce, 7 índices, 5 funções, 5 triggers, FKs e auditoria imutável; **manual** | organizations + dependência em crm.crm_employees |

**Tabelas pertencentes a Organizations (14):** platform_organizations, platform_org_memberships, platform_workspaces, platform_workspace_memberships, platform_units, platform_workspace_units, platform_org_audit, platform_legacy_backfill_runs, platform_staff_identity_links, platform_workspace_staff_roles, platform_staff_teams, platform_staff_team_workspaces, platform_staff_team_members, platform_staff_access_audit.

**Dependências externas explicitamente qualificadas:**
- CRM: crm.crm_people, crm.crm_organizations, crm.crm_tags, crm.crm_channel_identities, crm.crm_person_organizations, crm.crm_person_tags, crm.crm_employees.
- Inbox: inbox.inbox_conversations, inbox.inbox_messages.
- WhatsApp: whatsapp.whatsapp_accounts, whatsapp.whatsapp_conversation_routes, whatsapp.whatsapp_outbox.
- Funções de contexto, backfill e workforce: organizations.platform_legacy_fill_*, organizations.platform_validate_*, organizations.platform_backfill_legacy_ownership e organizations.platform_staff_*. Todas passam a ter search_path=pg_catalog e referências explícitas.

A sequência 003–005 originalmente altera domínios externos. O candidato preserva esta semântica para auditoria, mas a propriedade final das migrations de CRM/Inbox/WhatsApp e a ordem de instalação dependem do contrato AK-30. **Não instalar 003–005 na condição atual.** A 007 continua manual e condicionada a CRM e SQL 002; a migration manual de ativação multi-org não foi alterada.

## Consumidores pendentes e riscos de conversão parcial

| Consumidor | Dependência a alterar quando os gates existirem |
| --- | --- |
| modules/organizations/src/service.ts | CTEs de bootstrap, backfill, membership, unidades, auditoria, testes dos índices por schema |
| modules/organizations/src/workforce.ts | Queries staff/teams/roles; JOIN de CRM employees e contextos |
| modules/core-crm/src/context-guard.ts | Org/workspace memberships antes de ler CRM; CRM passa a crm.* no módulo seguinte |
| modules/inbox/src/context-guard.ts e postgres.ts | Contexto, list/search/export/SSE, proteção contra vazamento entre organizações |
| modules/whatsapp/src/scope.ts e dispatch.ts | Rotas, contas, memberships; gateway Go precisa regressão |
| modules/support/src/service.ts | Escopo operacional sem bypass do proprietário global |
| apps/core-host/scripts/verify-org-readiness.mjs | Preflight do schema/indexes, sem presumir public |
| apps/core-host/src/tenant-database.ts e adapters.ts | Registry confiável e FGA preservados; habilitação real vem de AK-10 |
| infra/postgres/bootstrap/migrate-modules-tenant.sh | Substituir por instalador versionado aprovado; jamais duplicar instalador |

**Risco crítico:** mover fisicamente platform_organizations para organizations enquanto serviços ainda consultam public.platform_organizations gera falhas no runtime. Não tentar contornar via search_path amplo de pool. A preparação não está registrada no manifesto ativo.

## Código preparado, proteção e testes

A pasta modules/organizations/sql/schema-v2 contém os **sete SQLs gerados**, com nomes de schema explícitos, referências regclass corrigidas, funções protegidas de shadow no public e a trava física de 002 intacta. São artefatos candidatos, não migrations operacionalmente disponíveis.

O script modules/organizations/scripts/render-schema-v2.mjs é **compilador offline** sem URL de DB, acesso a credenciais ou instalador. Seu modo --check verifica a equivalência determinística. O arquivo SOURCE-MANIFEST.json possui SHA-256 do SQL original e do candidato; não é ledger de instalação. As implementações legadas em 001–007 continuam sendo a fonte original até a substituição coordenada.

Os testes schema-v2-artifacts.test.mjs e pg-schema-v2.test.mjs verificam checksum, neutralidade de manifest, execução/reaplicação SQL 001–007 em PostgreSQL 17 **descartável**, FKs, índices 002, escopos A/B, triggers CRM/Inbox/WhatsApp, revogação, auditoria, shadow em public e savepoint rollback. Testes antigos de Organizations continuam sem alterações de asserts.

## Billing futuro e autorização

**Employee ≠ User Identity ≠ Membership ≠ Operador faturável.** O Employee é registro CRM; a identidade estável vem de Keycloak issuer+sub; memberships, habilitações de módulo e autorizações OpenFGA são verificações distintas. Um vínculo ativo em platform_staff_identity_links ou papel agent **não** gera cobrança. Um futuro adaptador poderá apurar vínculos elegíveis e suas datas/estados conforme contrato de Billing ainda não aprovado; sem inferir preço, licenças ou quotas aqui.

O Owner global não recebe acesso operacional automático a nenhum tenant; o schema não introduz bypass nem grants. Mesmo a role técnica compartilhada por tenant ainda exige revisão de privilégios AK-30.03 antes de qualquer alegação de sandbox por módulo.

## Gate e encaminhamento

**AK-40.01:** inventário e artefatos candidatos preparados; **BLOQUEADO para integração/instalação** por AK-10.02/03/04 e AK-30.01/02/03. CI integrada, Keycloak/OpenFGA reais, roles SQL A/B, E2E CRM/Inbox/WhatsApp/Go, backup/restore de tenant com dados, rollback operacional e Product Gate seguem **PENDENTES**. Nenhum banco de DevServer01 foi migrado ou consultado para presumir ausência de dados.

**CRM (AK-40.02):** próximos objetos/consumidores mapeados, mas **não liberado** até Organizations ter contrato efetivo no Kernel/Host, installer ativo, migração com SHA testado e aceite do gate. Não implementar CRM por este PR.
