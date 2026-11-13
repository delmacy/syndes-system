---
title: "C01 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)

> L20: \| **CI baseline** \| [Run 43359636260](https://github.com/delmacy/syndes-system/actions/runs/43359636260): **24/24 jobs success** no SHA `ac8deb8` \| Testes PG17 descartáveis, não rollback/restore do Control persistente \|

> L27: 3. **P1 — seis migrations Control pendentes:** stages 001–006 com checksums versionados; ledger ausente e roles de módulos não criadas. **Não aplicar** sem backup, restore, release SHA, owner e Product Gate.

> L28: 4. **P1 — Account roles/delegação ausentes:** tabelas/funções do contrato Account não confirmadas; dependências da A06/FGA reais precisam de gate próprio.

> L30: 6. **P1 — testes/disponibilidade reais:** CI aprovada em fixtures; falta provar a composição Host/Manager/Control do ambiente persistente, negativas de tenant e recovery.

> L31: 7. **P1 — outros ambientes sem evidência:** conectores `server02` e `win1-server` offline durante a auditoria; não inferir produção inativa ou conforme.

> L40: \| **55.03** \| Installer/entitlements/gates \| API opt-in e teste PG17; Control/restore/FGA reais BLOQ \|

> L42: \| **CP-E01..E07** \| Artefatos/versionamento e testes Control Events \| No Git; WBS registra entrega em worktree, **não aplicada operacionalmente** \|

> L49: A sequência correta é revisar os consumers reais e a versão da instalação, obter evidência de backup/restore e aprovação para um plano de migração, realizar ensaios negativos em staging e só então decidir se/como aplicar os schemas. **Esta entrega não abre gate de migration nem modifica dados.**

> L53: \| Momento \| Fonte \| Evidência \| Não comprovado \|

> L55: \| 13/11/2026 04:38Z \| DevServer01, `syndes_control`, somente leitura \| Registry, Manager base, um tenant ativo; catálogo/roles/eventos ausentes, 6 PENDING \| Dados de clientes, Product Gate, backup/restore, staging \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/REFERENCIA-TECNICA.md)

> L11: \| C02 \| `scripts/control/module_migrations.py`, `infra/postgres/bootstrap/migrate-modules-tenant.sh` \| Installer/operador de migrations; somente com release SHA, backup/restore, checksum e gates \|

> L13: \| A04 \| `apps/core-host/src/module-catalog.ts`, `module-lifecycle.ts`, `module-effective-access.ts`, `module-installer.ts` \| Adapters PostgreSQL, readmodels, gates opt-in e installer trusted \|

> L50: \| A04 Host \| `PgEffectiveModuleAccess.canExecuteModule()` \| Retorna **false em erro de schema/Control**; não garante que todos os controllers apliquem o gate \|

> L53: \| A05 Manager \| `GET /v1/platform/admin/tenants/:id/modules` \| Consulta catálogo/entitlements/installs; tabelas ausentes **podem causar 503** (código trata erro); sem teste HTTP live \|

> L60: Essa infraestrutura consta do **SQL versionado**, mas foi constatado que o schema `control_events` não está instalado na instância. **Nenhum dispatcher Control foi homologado ou ativado por este trabalho.** A outbox tenant-local de CRM/Inbox/WhatsApp em `platform_events` possui owner e gates separados.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/OPERACAO.md)

> L7: - [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

> L45: Antes de qualquer alteração, exigir: comparação de runtime/consumer com schema realmente implantado; owners C01/I04/C02/A04/A05/C06; backup real e restore isolado ensaiado; checksum/SHA da release; janela e reversão; grants e testes negativos A/B; gate explícito. Não usar essa documentação como autorização operacional.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/06-wbs-marcos-e-aceite.md)

> L18: \| **CP-E01/E02** \| `control_events` 006 e trigger audit→outbox \| SQL versionado no Git, testes PG17 descartáveis; **não instalado no DevServer** \|

> L23: \| **CP-G02** \| Dispatcher Control + identidade/FGA \| **BLOQUEADO** até schemas/grants e Product Gate \|

> L32: 4. Somente então executar migrations 001–006 via operação separada, com teste de grants, tenant A/B, idempotência e transação. **Não realizado nesta auditoria.**

> L33: 5. Exigir teste HTTP de Manager `/tenants/:id/modules`, pipeline do Host, service identity, autorização e CP-G02/03 antes de declarar integração/aceite.

> L35: **Continuidade do plano documental:** próxima unidade **C03 — Identity Keycloak**; incidentes relacionados a C01 ficam registrados com owner/gate, sem avançar código por conta própria.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
