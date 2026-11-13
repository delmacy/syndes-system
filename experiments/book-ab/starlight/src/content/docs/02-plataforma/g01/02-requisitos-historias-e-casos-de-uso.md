---
title: "G01 · Requisitos e casos de uso"
description: "Volume Plataforma e core · capítulo G01 · matéria 02"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/02-requisitos-historias-e-casos-de-uso.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 2. Requisitos, histórias e casos de uso

Esta página descreve **critérios arquiteturais derivados de ADRs e AGENTS já existentes**, não introduz novas features nem aprova uma PRD.

### Invariantes rastreados

| Regra identificada | Fonte / owner | Verificação necessária |
|---|---|---|
| Tenant seleciona apenas DB validado pelo Host; identificador do navegador não determina DSN | [Core Framework](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/CORE-FRAMEWORK-ARCHITECTURE.md); A08/A04 | Teste negativo A/B e provider confiável |
| Tenancy **e** autorização por recurso exigidas, com falha fechada | [Kernel contracts](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/CORE-FRAMEWORK-ARCHITECTURE.md); A08/C04 | JWT/Keycloak, FGA, membership, erros e negação |
| Manager não lê conteúdo dos tenants por papel global | [Manager boundary](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-PLATFORM-MANAGER-BOUNDARY.md); A05/C01 | ACL SQL, tokens cross-client e rede real |
| Módulo compilado no Host ≠ enabled para qualquer tenant | [Composição Control/Tenant](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-CONTROL-TENANT-MODULE-COMPOSITION-20261110.md); A04/C02 | Entitlement, install ledger, lifecycle/ModuleAccessPort |
| Um owner mantém a fonte normativa de dados/contratos | [ADR Kernel e schemas](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md); owners | Importação por exports, revisão de schema e writers |
| Eventos tenant e eventos Control usam DB/schemas distintos | [ADRs de eventos](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-PLATFORM-EVENTS-20261111.md); C06/C01 | Outbox na mesma transação e replay idempotente |
| Workspace, Manager e Support não compartilham sessão nem autorização | [ADR de composição](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md); A01–A03 | Builds, OIDC, políticas e E2E separados |

### Histórias de consulta — exemplos para documentação (não requisitos de produto aprovados)

- **Como Tech Lead**, quero localizar o owner de um contrato e sua decisão arquitetural para evitar dependência privada ou implementação duplicada.
- **Como engenheiro de módulos**, quero saber se um símbolo é um export público, uma API HTTP declarada ou uma interface interna antes de integrar consumidores.
- **Como auditor de segurança**, quero distinguir permissão global, membership de tenant e autorização OpenFGA para formular testes negativos.
- **Como responsável por release**, quero identificar gates pendentes por decisão antes de autorizar migrations, workers ou deploy.

### Casos de uso documentais

| Caso | Entrada | Fluxo esperado | Saída |
|---|---|---|---|
| Validar mudança de contrato | proposta de assinatura/versão em owner | identificar consumers e ADR → diff → testes → revisão | decisão e evidências vinculadas |
| Registrar nova fronteira | conflito de ownership entre módulos | verificar catálogo → ADR existente → marcar pendência → solicitar decisão | owner confirmado ou bloqueio explícito |
| Auditar capacidade habilitada | módulo presente no Host/config | comparar build, instalação, grants, tenant, autorização, logs e teste | estado multidimensional, sem inferir homologação |
| Solicitar alteração arquitetural | necessidade após MVP/bug/blocker | classificar pelo AGENTS → impacto por módulo → ADR e WBS | proposta sujeita a aprovação, não código automático |

**Requisitos ainda não elicitados:** níveis mensuráveis de performance, RTO/RPO de cada ambiente, schemas futuros por módulo e contratos remotos entre hosts carecem de aprovação/medição específica. Não preencher números por suposição.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/02-requisitos-historias-e-casos-de-uso.md).
