---
title: "Q10 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/STATUS.md)

> L11: \| **Integração CI** \| **Falha de paridade em mainline** \| [Run 43335397128](https://github.com/delmacy/syndes-system/actions/runs/43335397128), SHA `69670e2`: job `foundation` reprovou paridade; gate global falhou \|

> L12: \| **Suites de negócio, autorização e integração** \| **Não reexecutadas pela Q10** \| Q02–Q09 e owners; não usar scripts existentes como evidência de testes aprovados \|

> L32: 4. **Segurança/tenancy:** não foram testadas nesta auditoria negações cross-tenant, Keycloak/OpenFGA real, SQL com tenant A/B, multi-org nem identidade service.

> L41: - **Próxima unidade:** Q07 — CI central (documentar/paridade e dependências). Alterações executáveis na CI exigem frente própria autorizada, sem enfraquecer testes.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/REFERENCIA-TECNICA.md)

> L8: - **Dependências de processo:** `scripts/architecture/check-work-units.mjs`, `catalog/work-units.json` e `AGENTS.md` nos módulos.

> L29: - Unit, integração, E2E, segurança, infra e performance pertencem a Q02/Q03/Q04/Q05/Q09/Q06 e seus módulos.

> L39: **Q10 não possui tabelas PostgreSQL, schema próprio, migrations nem dependência de banco operacional.** Os testes de migrations e restore estão sob ownership de módulos, infraestrutura e equipes de qualidade; prova descartável de PostgreSQL não equivale a migration aplicada/backup restaurado em produção.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/OPERACAO.md)

> L9: - [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/04-contratos-e-dependencias-publicas.md)

> L11: \| Q02/Q03 — testes por módulo e integração \| Unidades, contratos, integridade de estado e migrations \| Mock/PG descartável ≠ sistema operacional \|

> L12: \| Q04/Q05 — browser, identidade e segurança \| E2E com perfis, autorização, isolamento e falha segura \| Token fictício não comprova Keycloak/OpenFGA real \|

> L21: \| Revisão \| SHA integral, árvore/artefato e dependências relevantes \|

> L22: \| Camada \| Unit, contrato, integração, segurança, E2E, infra, RC, operação \|

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L30: \| **Integração/contrato** \| Q03 + módulos; API/PG/migrations/events/idempotência \| Só integração no ambiente do ensaio \|

> L40: \| Erro OpenFGA/Keycloak \| Sem fallback permissivo, operação negada e auditoria sanitizada \|

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
