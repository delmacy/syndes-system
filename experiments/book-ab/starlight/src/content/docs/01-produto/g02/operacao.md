---
title: "G02 · Operação e implantação"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Operação e implantação

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL (produto/UX e fonte estática) — 12/11/2026.** Checkout `origin/main` SHA `36b7ebeabee236196e71b2f43f2ee92a4e0b49c9`, DevServer01/worktree isolada. Revisão dos PRDs, ADRs, fonte de React e contratos documentados. Não foram executados browser autenticado, testes de tenant real, deploy, alteração de banco ou aceite do produto.

> L13: \| **Operação** \| **Não aplicável à G02 como serviço** \| Deploy e módulos/ambientes devem ser auditados por A01–A03, P01–P06 e Infra \|

> L25: \| `PRD-SYNDES-SUPPORT.md` \| Support interno/externo da fornecedora com fronteira própria \| Não confundir com P05 nem presumir deploy \|

> L26: \| `ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md` \| Contextos Workspace/Manager/Support separados; `front-shared` visual \| Não prova separação de sessões/permissões implantada \|

> L56: \| 2026-11-12 \| `36b7ebeabee236196e71b2f43f2ee92a4e0b49c9` · DevServer01, worktree isolada \| PRDs, ADRs e fonte React revisados \| Homologação, deploy, segurança E2E, aceitação comercial \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA DOCUMENTAL E DE FONTE ESTÁTICA PARCIAL — 12/11/2026.** Revisão do checkout `origin/main` SHA `36b7ebeabee236196e71b2f43f2ee92a4e0b49c9`. G02 é governança de requisitos, experiências e Product Gates, **não** pacote executável. Nenhuma verificação de UX com identidade real, deploy ou banco operacional foi executada nesta auditoria.

> L46: - [STATUS](STATUS.md) distingue documentação, implementação, integração, operação e Product Gate.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/OPERACAO.md)

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L16: **Interpretação:** a figura representa os **contextos de UX de produto**; não implica que uma rota, botão, consumer ou deploy esteja disponível. O Host e as regras de autorização reais pertencem aos owners de A04, C01, C03, C04 e dos módulos.

> L25: \| Manager \| Metadados globais sem dados privados tenant \| `apps/master-admin-web/src/App.tsx`, `src/app/ManagerShell.tsx` \| Roles SQL, OIDC, grants e deploy alvo \|

> L26: \| Support \| Fluxos de case/queue próprios da Syndes \| `apps/support-web/src/App.tsx`; [PRD](../../../product/PRD-SYNDES-SUPPORT.md) \| Autorização para público interno/externo e evidência de operação \|

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/06-wbs-marcos-e-aceite.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
