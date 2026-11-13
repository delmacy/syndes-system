---
title: "G01 · Operação e implantação"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Operação e implantação

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 12/11/2026.** Revisão **estática de documentação, catálogo, manifests e código** no checkout de `origin/main` SHA `b73f42adf47a9b766790f399e13529b470aef171` (DevServer01/worktree isolada). Não foram executados deploy, migrações, testes de autorização com serviços reais ou Product Gate. **Revisão documental não é homologação arquitetural.**

> L11: \| **Arquitetura de componentes** \| **Código e configuração encontrados** \| Kernel/Host/plugins/frontends presentes no checkout; a presença em Git não prova operação \|

> L13: \| **Operação** \| **Não se aplica à G01 como serviço** \| Deploys pertencem aos respectivos módulos e infraestrutura; ambiente-alvo não auditado \|

> L25: \| `apps/master-admin-web`, `apps/workspace-web`, `apps/support-web`, `packages/front-shared` \| Projetos e compartilhamento visual presentes \| Deploy independente, OIDC e isolamento verificados no ambiente \|

> L36: 5. Não se executaram testes de integração, E2E, restore, autorização real ou verificação de deploy nesta revisão; o CI da futura SHA documental também requer checagem separada.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/REFERENCIA-TECNICA.md)

> L10: - **Arquitetura ≠ implantação:** o arquivo `apps/core-host/config/modules.json` declara cinco plugins trusted, sem provar ENABLED/entitlement em tenant.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/OPERACAO.md)

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L22: **Interpretação:** setas representam relações arquiteturais de contexto, **não** teste de rede nem contrato operacional de cada seta. Os aplicativos, portas e bancos devem ser auditados nos owners antes de afirmar deploy. O catálogo do Host lista cinco packages confiáveis no commit da revisão; não indica ativação por tenant nem disponibilidade de todos os serviços.

> L56: - Perfis de composição, migração por schema e gates de multi-org permanecem **evoluções controladas**, não invariantes comprovadas no deploy.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/06-wbs-marcos-e-aceite.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
