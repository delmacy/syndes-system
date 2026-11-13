## 4. Contratos públicos, internos, SQL, APIs e eventos

**C01 não é um pacote com `export` próprio nem um serviço HTTP específico.** As APIs reais pertencem a A04/A05/A06 e as interfaces portáveis pertencem a A08. O contrato primário do C01 é o **schema Control versionado e suas regras de transição**.

### Contratos SQL — owner de Control

| Fonte | Entidade/contrato | Efeito e situação |
|---|---|---|
| `control.schema` | `public.tenant_registry(tenant_id,database_name,role_name,state)` | Registry global; **presente**, 1 tenant `active` no DevServer |
| `control.schema` | `public.tenant_memberships(tenant_id,principal_id,state)` | Membership global; **presente**, com SELECT para `syndes_core` |
| `control-admin.schema` | `platform_operator_access` e `platform_tenant_profiles` | Metadados e role `syndes_master_api` somente leitura; **presentes** |
| `control-account-roles.schema` | `tenant_account_role_grants`, `tenant_account_role_audit` | Tabelas **ausentes** na instância examinada |
| `control-account-delegation.schema` | `apply_tenant_account_delegation` | Função versionada para A06; disponibilidade **não foi comprovada em runtime** |
| `control-module-catalog.schema` | `module_catalog`, `module_catalog_versions`, `module_catalog_dependencies` | Staged 001, **ausentes** |
| `control-module-lifecycle.schema` | `tenant_module_entitlements`, `tenant_module_installs`, `tenant_module_audit` | Stage 002; transições auditadas, **ausentes** |
| `control-module-attestation.schema` | Roles/funções de atestado de instalação | Stage 003 **PENDING** |
| `control-module-activation.schema` | Funções de habilitação/revogação | Stage 004 **PENDING** |
| `control-module-manager-readonly.schema` | Grants de leitura de módulo para Manager | Stage 005 **PENDING** |
| `control-module-events.schema` | `control_events.outbox_events`, `event_deliveries`, `consumer_inbox`, trigger | Stage 006 **PENDING** |
| `module_migrations.py` | `public.control_module_schema_migrations` com SHA-256/release commit | Ledger **ausente**, nenhum dos estágios 001–006 foi aplicado nesta auditoria |

### APIs de consumidor reais (não endpoints do C01)

| Owner/fonte | Interface | Limite da evidência |
|---|---|---|
| **A05** `apps/master-admin-api/src/server.mjs` | `GET /v1/platform/admin/me`, `/summary`, `/tenants`, `/tenants/:id`, `/tenants/:id/modules` | JWT e allowlist de operador; `/modules` depende de tabelas **ausentes** e tende a 503 em caso de erro SQL — **sem teste HTTP real neste host** |
| **A06** `apps/account-access-api/src/server.mjs` | POST restrito de delegação de roles de conta, com JWT/FGA | Depende das funções/tabelas Account ainda não instaladas no Control observado |
| **A04** `PgModuleCatalog.listAvailableForTenant()` | Consulta releases aprovadas; somente build trusted e tenant `active` | SQL referência `module_catalog` ausente no DevServer; não é entitlement |
| **A04** `PgModuleLifecycle.listModuleStates()` | Estado agregado de entitlement/instalação | SQL de módulo ausente; projection não é autorização |
| **A04** `PgEffectiveModuleAccess.canExecuteModule()` | Gate de módulo `granted` + `enabled` + metadados/verificação + deps | **Fail closed** no adapter; somente endpoints migrados para `CoreKernel.executeModule` recebem o gate |
| **A08** `ModuleCatalogPort`, `TenantModuleLifecyclePort`, `ModuleAccessPort` | Interfaces públicas de `@syndes/core-kernel` | Pacote `private:true`, não SDK distribuído/serviço C01 |

**API Manager de inventário:** `apps/master-admin-api/src/modules/tenant-module-inventory.mjs` consulta `module_catalog_versions`, `tenant_module_entitlements` e `tenant_module_installs`; sanitiza a resposta para **não expor schema, DB role, digest ou secret**. Ausência dessas tabelas no Control observado implica falha na consulta, não representação de módulos disponíveis.

### Contratos de eventos administrativos

- **Tipos v1** definidos em `packages/core-kernel/src/control-plane-events.ts`: `platform.module.entitlement.changed.v1` e `platform.module.installation.changed.v1`.
- **Origem normativa:** trigger `control_events.enqueue_module_audit()` após INSERT de `public.tenant_module_audit`; outbox no **mesmo commit** do Control. `auditEventId` e `correlationId` identificam causalidade, sem payload de mensagens.
- **Entrega:** `control_events.event_deliveries` com lease, retry, dead/suspended; `control_events.consumer_inbox` para idempotência por consumer. Fonte SQL está no repositório, mas **não instalada neste Control**.
- **Não confundir** com a outbox `platform_events` nos DBs dos tenants (CRM/Inbox/WhatsApp) ou com workers ativos; CP-G02/03 continuam bloqueados/pendentes.

### Contratos de mudança e trust

O host público **não recebe** SQL de migration nem nomes de databases fornecidos pelo cliente. Modificar Control schema/roles exige owner, revisão de segurança, ledger/checksum, backup e restore, SHA, janela e teste. Esta auditoria preserva todos os contratos executáveis, sem aplicar DDL.
