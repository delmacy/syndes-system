---
title: "C01 · Requisitos e casos de uso"
description: "Volume Plataforma e core · capítulo C01 · matéria 02"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/02-requisitos-historias-e-casos-de-uso.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 2. Requisitos de contrato e casos de uso existentes

IDs `C01-R*`, `US-C01-*` e `UC-C01-*` são **rótulos de auditoria** sobre contratos existentes, não novos requisitos de produto aprovados.

| Requisito rastreado | Fonte original | Evidência necessária |
|---|---|---|
| **C01-R01 — Registry confiável** | `control.schema`, `provision-tenant.sh` | UUID/DB/role canônicos, `state`, membership e negações |
| **C01-R02 — Admin somente metadados** | `control-admin.schema`, Manager `server.mjs` | GET com JWT e operador autorizado; sem acesso tenant DB |
| **C01-R03 — Contas delegadas** | `control-account-roles.schema`, `control-account-delegation.schema` | Token/FGA, role restrita, rollback, testes PG17; **schema live ausente** |
| **C01-R04 — Catálogo e approval** | `control-module-catalog.schema`, `PgModuleCatalog` | Versão, dependências e release approved em build confiável |
| **C01-R05 — Entitlement separado de instalação** | `control-module-lifecycle.schema`, `PgModuleLifecycle` | Transições auditadas com `valid_until`, estados e recibo |
| **C01-R06 — Verificação de instalador** | `control-module-attestation.schema`, `control-module-activation.schema` | Checksum/digest, ledger tenant, FGA e gates físicos |
| **C01-R07 — Gates efetivos** | `PgEffectiveModuleAccess`/A08 | `ENABLED` e dependências; exceção Control deve negar, não liberar |
| **C01-R08 — Eventos administrativos** | `control-module-events.schema`, A08 `control-plane-events.ts` | Audit→outbox na mesma transação, schemas por plano, consumidores idempotentes |
| **C01-R09 — Migrations rastreáveis** | `module_migrations.py` | PG17, SQL fixo, SHA-256, ledger ordenado, backup/restore e autorização |
| **C01-R10 — Separação Control/Tenant** | `infra/README.md` e SQL | Control sem PII de conversa, Manager sem DB tenant; tenant com role exclusiva |

### Histórias e casos de uso

**US-C01-01:** como responsável pela plataforma, quero ver tenants e seus estados sem obter acesso aos dados privados dos clientes.

**US-C01-02:** como operador, quero distinguir catálogo aprovado, entitlement, instalação, verificação e habilitação para evitar confundir `tenant active` com produto funcional.

**US-C01-03:** como responsável de release, quero que o plano de migrations identifique checksum/ordem/backup e exija aprovação, sem aplicar DDL por conveniência.

**US-C01-04:** como auditor, quero saber se uma rota Manager depende de tabelas ausentes no DB realmente instalado.

**UC-C01-A — Consulta Manager:** JWT válido → allowlist de `platform_operator_access` ativa → `GET /v1/platform/admin/tenants` ou `/summary` → SQL metadados. Para `/tenants/:id/modules`, o handler consulta catálogo/entitlements; **tabelas faltantes podem resultar em 503**, não em inventário vazio válido.

**UC-C01-B — Habilitação de módulo (projetada, não instalada):** release aprovado no catálogo → entitlement válido → instalação atestada/ledger tenant → estado `enabled` → deps/gates/FGA → entrypoint com `executeModule`; sem qualquer etapa, negar. **Código/SQL disponíveis não são prova de rollout.**

**UC-C01-C — Evento de módulo:** transição administrativa validada → `tenant_module_audit` append-only → trigger do Control 006 publica `control_events` atomicamente → entregas/inbox por consumer → dispatcher autorizado. **Trigger/dispatcher não estão ativos no Control observado.**

**UC-C01-D — Reconciliar banco:** consultar `--plan` → confirmar objetos/ledger → revisar backup, restore e SHA → decisão de owner e janela → eventual apply por operação separada. **Esta passagem realizou só as duas primeiras consultas**, sem DDL.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/02-requisitos-historias-e-casos-de-uso.md).
