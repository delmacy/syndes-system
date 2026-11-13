---
title: "P01 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 2026-11-12.** Evidência: worktree `b452a03e`; testes locais sem implantação. NÃO equivale a CI da SHA publicada, integração real, deploy ou Product Gate.

> L19: **Testes executados nesta revisão:** cd modules/core-crm && npm test — 29 PASS, 0 FAIL.

> L25: - SQL 002 continua travando multi-org; não remover ou migrar sem Product Gate, restore e autorização.

> L35: \| Data \| Ambiente \| Evidência \| Lacuna \|

> L37: \| 2026-11-12 \| DevServer01 checkout `b452a03e` \| Fonte e testes locais listados acima \| Sem staging/CI da publicação, IAM real, restore e aceite \|

> L46: - Código Core CRM, APIs, plugin, SQL 001–003, testes e funcionalidades de Workspace presentes no repositório.

> L47: - Aceite de desenvolvimento no backend documentado; testes de frontend com API e identidade simuladas não fecham Product Gate.

> L49: - Modo de gate CRM de módulo ainda possui compatibilidade `legacy\|enforce`; Control Plane/migrations e grants reais são pré-requisitos de ativação segura.

> L57: \| WBS \| Evidência conhecida \| Estado de entrega atual \| Próxima verificação \|

> L59: \| P01.01 \| `modules/core-crm/sql`, `src`, testes de PostgreSQL descritos no aceite CRM \| Código/testes relatados, revalidar na SHA \| Suite SQL e tenants A/B \|

> L63: \| P01.05 \| Product Gate CRM explicitamente aberto \| Não concluído \| Demo e decisão de aceite \|

> L68: - **Bloqueadores:** E2E real de identidade/FGA; readiness de tenant e Control; observabilidade/restore do gate final.

> L77: **Saída do chat:** onde paramos; WBS; teste/CI/ambiente; o que bloqueia; para onde vamos; mudanças de escopo propostas para aprovação.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/REFERENCIA-TECNICA.md)

> L31: - Eventos CRM↔Inbox têm versões no catálogo de contratos, mas **a conexão automática ainda depende de gates**.

> L50: - Testes locais: **29 PASS**; integração real, manager↔tenant, E2E e Product Gate pendentes.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/OPERACAO.md)

> L7: - [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
