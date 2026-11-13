---
title: "C01 · WBS e critérios de aceite"
description: "Volume Plataforma e core · capítulo C01 · matéria 06"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/06-wbs-marcos-e-aceite.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 6. WBS de C01, entrega de eventos e aceite

A [EVOLUÇÃO C01](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/EVOLUCAO.md) vincula os IDs **20.04, 30.03, 40.02, 55.03, 90.02, 90.03**. Os estados na WBS mestre são históricos e não foram promovidos. O plano especializado [CP-E/G](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-CONTROL-PLANE-EVENTS-20261111.md) separa código/artefatos, instalação e consumers operacionais.

| ID | Origem | Status na fonte | Prova que falta |
|---|---|---|---|
| **20.04** | Provisionar `syndes_master_api` + OpenBao AppRole | BLOQ infra | Role SQL presente e SELECT verificado; identidade/secrets/serviço completo não homologados |
| **30.03** | Account Owner/Admin e delegação | BLOQ | SQL Account e função não observados, FGA real e regressões |
| **40.02** | Syndes como tenant convencional | BLOQ | Registry tem um tenant `active`, mas **não podemos atribuir identidade ou tenant operacional** sem prova |
| **55.03** | Installer/entitlements e API `enabled` | BLOQ em Control/restore/FGA reais | SQL 001–006 pendentes; schema tenant e ledger ausentes no DB examinado |
| **90.02** | Produtor de métricas agregadas Support→Manager | BLOQ | Design e contrato sem PII, identidade de serviço e isolamento |
| **90.03** | API de leitura de snapshots/estado stale | BLOQ | Dependência do produtor e consentimento de exposição de metadados |

### CP-E01–E07 — código versus operação

| Plano | Conteúdo | Comprovação |
|---|---|---|
| **CP-E01/E02** | `control_events` 006 e trigger audit→outbox | SQL versionado no Git, testes PG17 descartáveis; **não instalado no DevServer** |
| **CP-E03–E05** | Contratos v1, inbox/deliveries e FK tenant/module/grants | Código/SQL versionados; sem workers/grants reais |
| **CP-E06** | Migration runner checksum-pinned 001–006 | `--plan` no DevServer: **6 PENDING** |
| **CP-E07** | ADR/WBS/instruções | Fontes disponíveis; aprovação humana específica pendente |
| **CP-G01** | Apply Control 001–006 | **BLOQUEADO**: backup real, restore ensaiado, release SHA, janela e autorização |
| **CP-G02** | Dispatcher Control + identidade/FGA | **BLOQUEADO** até schemas/grants e Product Gate |
| **CP-G03** | Consumers Manager/readmodel + observabilidade e replay | **PENDENTE** |
| **CP-G04** | Multi-org/SQL002/reconciliação WhatsApp | **FORA DE ESCOPO** desta frente |

### Condições antes da promoção

1. Resolver qual é o ambiente e o release em uso, SHA do Host e papel do Control existente; comparar consumers com tabelas/índices.
2. Examinar backup/recovery **real**, versão PG17, plano de rollback, restore em local segregado e checksum/ledger sem dados pessoais publicados.
3. Obter sign-off de C01/I04/C02/C06/A05/Segurança para iniciar **qualquer** migração ou grant.
4. Somente então executar migrations 001–006 via operação separada, com teste de grants, tenant A/B, idempotência e transação. **Não realizado nesta auditoria.**
5. Exigir teste HTTP de Manager `/tenants/:id/modules`, pipeline do Host, service identity, autorização e CP-G02/03 antes de declarar integração/aceite.

**Continuidade do plano documental:** próxima unidade **C03 — Identity Keycloak**; incidentes relacionados a C01 ficam registrados com owner/gate, sem avançar código por conta própria.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/06-wbs-marcos-e-aceite.md).
