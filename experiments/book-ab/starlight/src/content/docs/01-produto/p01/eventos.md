---
title: "P01 · Eventos e mensageria"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Eventos e mensageria

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 2026-11-12.** Evidência: worktree `b452a03e`; testes locais sem implantação. NÃO equivale a CI da SHA publicada, integração real, deploy ou Product Gate.

> L48: - Integração de eventos de identidade WA/Inbox demonstrada sinteticamente em PostgreSQL descartável; tratativa humana de `review_required` não operacional.

> L61: \| P01.03 \| `src/whatsapp-identity-events.ts`, WBS WA/CRM \| Integração sintética; cutover pendente \| Eventos, grants e replay \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/REFERENCIA-TECNICA.md)

> L23: \| `CrmWhatsAppIdentityPolicy` / `CrmWhatsAppIdentityConsumer` \| `src/whatsapp-identity-events.ts` \| Resolução/revisão de identidade; consumidor opt-in, não pipeline operacional garantido \|

> L31: - Eventos CRM↔Inbox têm versões no catálogo de contratos, mas **a conexão automática ainda depende de gates**.

> L36: - **Frontend embutido legado:** `modules/core-crm/public/` publicado pelo plugin, se instalado e autorizado.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
