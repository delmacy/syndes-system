---
title: "P01 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/REFERENCIA-TECNICA.md)

> L8: - **Stack:** TypeScript 5.9, módulo NestJS `CrmHttpModule`, repositório PostgreSQL e contratos do `@syndes/core-kernel`.

> L9: - **Imports permitidos:** `@syndes/core-crm` e `@syndes/core-crm/plugin`; conferir `package.json#exports`.

> L22: \| `PgCrmRepository` / `PgCrmRepositoryFactory` \| Repositório TS em `src/postgres.ts` \| Persistência tenant-scoped, detalhes internos não expostos como contrato por arquivo \|

> L31: - Eventos CRM↔Inbox têm versões no catálogo de contratos, mas **a conexão automática ainda depende de gates**.

> L46: \| **Control/Manager DB** \| Nenhuma tabela própria CRM \| Entitlements e tenancy pertencem ao Control Plane; consulta via contrato confiável \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/OPERACAO.md)

> L16: - [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
