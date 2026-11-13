---
title: "P01 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 2026-11-12.** Evidência: worktree `b452a03e`; testes locais sem implantação. NÃO equivale a CI da SHA publicada, integração real, deploy ou Product Gate.

> L23: - Keycloak/OpenFGA com memberships tenant/organização/workspace e negações 401/403 em HTTP e browser reais (WBS 50.02).

> L48: - Integração de eventos de identidade WA/Inbox demonstrada sinteticamente em PostgreSQL descartável; tratativa humana de `review_required` não operacional.

> L53: **Próximo marco:** revisar/assinar o ESCOPO P01, depois confirmar SHA e lacunas atuais e homologar a jornada CRM Workspace com JWT Keycloak, OpenFGA e tenants separados.

> L61: \| P01.03 \| `src/whatsapp-identity-events.ts`, WBS WA/CRM \| Integração sintética; cutover pendente \| Eventos, grants e replay \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/REFERENCIA-TECNICA.md)

> L35: - **Workspace:** `apps/workspace-web/src/features/crm.tsx` e `crm-person-detail.tsx` existem no código. Rotas e comportamento com Keycloak/OpenFGA real precisam de browser E2E.

> L50: - Testes locais: **29 PASS**; integração real, manager↔tenant, E2E e Product Gate pendentes.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/OPERACAO.md)

> L9: - [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
