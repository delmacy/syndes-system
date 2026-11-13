## 4. Contratos de dados, scripts e limites de execução

I04 expõe **contratos de PostgreSQL/SQL e scripts operacionais**, não endpoints REST, eventos SaaS ou `package exports`.

| Artefato | Interface / efeitos declarados | Observação ou gate |
|---|---|---|
| `infra/postgres/compose.yaml` | Serviço `postgres:17-bookworm`; Docker Secrets `POSTGRES_PASSWORD_FILE`; volume `postgres_data`; redes `syndes-data` e `syndes-master-data`; `pg_isready` | Sem porta DB publicada pelo Compose; saúde Docker `healthy` observada |
| `bootstrap/00-init.sh` | Inicializa roles `syndes_keycloak`, `syndes_openfga`, `syndes_core` e os três databases técnicos | **Somente no volume novo**, não atua como migrador de bases persistentes |
| `bootstrap/control.schema` | `public.tenant_registry`, `public.tenant_memberships`; restrição `PUBLIC`, `syndes_core` com `SELECT` | Objetos e grants básicos encontrados no DevServer01 |
| `bootstrap/provision-tenant.sh` | `TENANT_ID` UUID validado; role `syndes_t_<uuid sem hífens>`, DB `syndes_tenant_<uuid>`, `REVOKE CONNECT`, estado `provisioned` | Requer operador e senha única protegida; **não é API pública** |
| `bootstrap/control-admin.schema` | `syndes_master_api`, `platform_operator_access`, `platform_tenant_profiles`, SELECT global limitado | Role e tabelas presentes; demais fluxos Manager têm gates próprios |
| `scripts/control/module_migrations.py --plan` | Verifica versão PG17/target/ledger, checksums fixos dos seis SQL e estado sem DDL | Executado; **seis PENDING**, sem apply |
| `scripts/control/module_migrations.py --apply` | SQL Control transacional, lock/advisory, pin SHA, backups e restore-ID | **Não executado.** Exige autorização operacional explícita; não usar para corrigir a documentação |
| `bootstrap/tenant-module-ledger.schema` | `_syndes.module_migrations` com `module_id`, `migration_id`, `version`, `checksum`, `image_digest` | Não encontrado no DB tenant auditado; runtime role não deve poder alterar ledger |
| `bootstrap/migrate-modules-tenant.sh` | Confere mapping em Control; imagem `@sha256` e migrations do Host; `SET ROLE` no DB do tenant | **Não executado**; depende de release, backup/restore e gates |
| `bootstrap/support-migration-gate.sh` | Support migration somente se `TENANT_ID` corresponder ao tenant operacional permitido | Evita provisionar Support em tenant comercial; não é autorização de API |
| `tests/platform/postgres-smoke.sh` | Teste de três bancos, negativa de Keycloak→Control, provisionamento duplicado e restore de fixture | Ambiente **descartável de CI**, não evidência de restore real |
| `apps/core-host/test/*pg17*.test.mjs` | Instalador, Control/events, FGA, tenant A/B, migration ledger e módulos | Evidências por suite/CI, não autorização para aplicar schemas no DevServer |

### Domínio público x privado

- **Contratos públicos de módulos:** APIs/ports/versionamento de CRM, Inbox, WhatsApp, Organizations, Support e Service pertencem aos owners; SQL infra de I04 não é biblioteca reutilizável pelo frontend.
- **Contrato privado de infraestrutura:** formatos de DB/role, grants, transação e ledger. O nome canônico é derivado do UUID aprovado **server-side**, sem escolher banco por parâmetro de cliente.
- **Eventos:** outbox Control em `control_events` e outbox de tenant em `platform_events` são domínios distintos, com tabelas, regras e owners distintos.
- **Segredos:** paths de Docker Secrets/roles são documentação de **estrutura**. Credenciais/DSNs, chaves, mounts completos, contas reais e query results pessoais não entram nas páginas públicas.
- **Mudanças de SQL:** requerem ownership C01/C02/C06 ou módulo, revisão de impacto, SHA/digest, backup/restore e rollback; mera presença de arquivo `.schema` não autoriza aplicação.

### Comparação de contrato versus runtime

Control base (registry/membership) e Manager base estão **instalados**; catálogo/entitlements/events de módulos estão **ausentes** na instância examinada. O migrador Control de fato informa as seis etapas como **PENDING**. No DB tenant observado, os schemas de módulo e o ledger `_syndes` não apareceram. Isso é **diferença de estado**, não falha comprovada dos contratos versionados.
