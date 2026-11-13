## 2. Requisitos de persistência e casos de uso

Os códigos `I04-R*`/US/UC aqui são identificadores **documentais para rastreio** de contratos já existentes. Não aprovam novas features ou ações de DBA.

| Critério | Origem | Prova antes de aceite |
|---|---|---|
| **I04-R01 — Identidade do DB** | Compose/`00-init.sh` | Versão e banco-alvo corretos; não confundir DB Control e tenant |
| **I04-R02 — DB separado por tenant** | `provision-tenant.sh` | UUID canônico, nome estável, role exclusiva e `PUBLIC CONNECT` revogado |
| **I04-R03 — Menor privilégio** | `control.schema`, `control-admin.schema` | `syndes_core` somente Control SELECT; Manager sem conteúdo tenant; negações de SQL reais |
| **I04-R04 — Provisionamento seguro** | `provision-tenant.sh` e Control | Repetição idempotente, state `provisioned`, nenhum entitlement automático |
| **I04-R05 — Migração Control por versão** | `scripts/control/module_migrations.py` | Plano, ledger, SHA/digest, checksum e rollback do ambiente; `--apply` somente com autorização |
| **I04-R06 — Migration tenant protegida** | `tenant-module-ledger.schema`, `migrate-modules-tenant.sh` | Identidade/role, banco canônico, imagem por digest, checksums e regressão cruzada |
| **I04-R07 — Support tenant-only** | `support-migration-gate.sh` | Support SQL somente no tenant operacional aprovado |
| **I04-R08 — Multi-org controlado** | Organizations SQL 002 e manual activation | Índices e guardas intactos até Product Gate explícito |
| **I04-R09 — Event schemas separados** | Control events e tenant `platform_events` | Outbox/inbox e migrações corretas por banco e worker próprio |
| **I04-R10 — Backup/Restore real** | WBS 10.07, I10, Q08 | Snapshot consistente de DBs/roles, teste de restore isolado, RPO/RTO medidos |

### Histórias documentais

**US-I04-01:** como DBA, preciso distinguir o SQL presente no Git dos objetos realmente instalados no DevServer01, para não executar migrations em banco incorreto.

**US-I04-02:** como responsável de segurança, preciso verificar `CONNECT`, `SUPERUSER` e grants por role, sem inspecionar clientes, para identificar falhas estruturais de isolamento.

**US-I04-03:** como desenvolvedor, preciso saber quais schemas pertencem ao Control e quais ao tenant, a fim de impedir migrations de CRM/Inbox/WhatsApp em banco global.

**US-I04-04:** como operador, preciso de plano de `migration`/restore aprovado com checksum e evidência por SHA, antes de aplicar DDL em ambiente persistente.

### Casos de uso e negativas

**UC-I04-A — Tenant aprovado:** validar UUID server-side → provisionar role/db → `REVOKE CONNECT PUBLIC` → registrar `provisioned` no Control → habilitação e FGA **separadas**.

**UC-I04-B — Controle de migrações:** identificar target DB e SHA → `--plan` → comparar ledger/objetos → verificar backup e restore → aprovação do owner → aplicar de forma transacional → validar grants/contratos/rollback. **Somente `--plan` foi exercitado nesta auditoria.**

**UC-I04-C — Negativas A/B:** testar `syndes_core`/Manager/tenant A contra DB do tenant B; bloquear usuários sem membership e impedir SQL sem role adequada. As verificações desta passagem cobriram **catálogo de privilégios do único tenant observado**, não todos os cenários de API.

**UC-I04-D — Banco em desvio:** schema esperado ausente, objeto sem ledger ou migration alterada → registrar divergência → bloquear apply automático → owner decide gate. Não interpretar ausência de schema como autorização para criá-lo.
