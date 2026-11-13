## 3. Capabilities reais, parciais e não instaladas

### Control DB DevServer01 — snapshot 13/11/2026 04:38:21Z

| Capacidade | Código disponível | DB/serviço observado |
|---|---|---|
| Tenant Registry | `control.schema`, `provision-tenant.sh` | **Instalado:** `tenant_registry`, `tenant_memberships`; **1 tenant ativo** no registry |
| Metadados Manager | `control-admin.schema`, Manager API | **Instalado:** `platform_operator_access`, `platform_tenant_profiles`; role de leitura sem DML de perfis |
| Account roles e delegação | `control-account-roles.schema`, `control-account-delegation.schema` | **Ausentes:** `tenant_account_role_grants`, `tenant_account_role_audit` |
| Catálogo de módulos | `control-module-catalog.schema` | **Ausente:** `module_catalog`, `module_catalog_versions`, dependências |
| Entitlements e instalação | `control-module-lifecycle.schema` | **Ausentes:** `tenant_module_entitlements`, `tenant_module_installs`, `tenant_module_audit` |
| Install attestation/activation | `control-module-attestation.schema`, `control-module-activation.schema` | As funções/roles de módulo **não podem ser consideradas implantadas**; 003/004 pendentes |
| Leitura do Manager por módulo | `control-module-manager-readonly.schema`, Manager inventory | A rota existe no código, **mas depende de tabelas ausentes**; execução em produção não ensaiada |
| Control Events | `control-module-events.schema`, A08 event contract | **Ausentes:** outbox, delivery, inbox no schema `control_events` |
| Core Host adapters | `PgModuleCatalog`, `PgModuleLifecycle`, `PgEffectiveModuleAccess` | **Código no Git**; acesso efetivo depende do Control compatível; não confundir com API já integrada |
| Migrador versionado | `scripts/control/module_migrations.py` | `--plan` no DevServer: **001–006 PENDING**; ledger `control_module_schema_migrations` **ausente** |
| Dispatcher/consumers Control | CP-G02/03 da WBS | **Não implantados/aceitos**, sem identidade FGA/workers autorizados |
| Multi-org e business data | Owners Organizations/CRM/Inbox/WhatsApp | Fora da C01; nenhuma promoção de SQL 002 ou dados tenant |

### Diferenças importantes de semântica

- `tenant_registry.state='active'` indica **estado administrativo do tenant**, não execução de módulos nem prova de que o banco tenant possua CRM/Inbox.
- Uma versão aprovada no catálogo só é **disponível no build confiável**; nunca equivale a `entitled`, `installed`, `enabled` ou autorização FGA.
- Uma instalação com `verification_digest` registrado não substitui prova real do ledger tenant nem garante que todo controller use `executeModule`.
- A API Manager `GET /v1/platform/admin/tenants/:id/modules` é implementada em código e filtra metadados. **No Control observado faltam suas tabelas SQL, portanto não declarar funcionalidade homologada**.
- O evento `platform.module.entitlement.changed.v1` / `platform.module.installation.changed.v1` é contrato de administração; nenhum conteúdo de mensagens ou contatos vai ao Control.

### Testes versus operação

O commit base `ac8deb8` passou [CI integrado 24/24](https://github.com/delmacy/syndes-system/actions/runs/43359636260), incluindo testes PG17 descartáveis de Control/Manager/Host. Isso comprova o **código sob teste naquele SHA**, não o estado instalado no DevServer. A inspeção live mostrou as seis migrations Control pendentes, com SQL base de tenant/Manager já aplicado.
