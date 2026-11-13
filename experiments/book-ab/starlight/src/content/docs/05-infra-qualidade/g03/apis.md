---
title: "G03 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)

> L10: \| **Runtime G03** \| **Não aplicável** \| Owner é `AGENTS.md`; não possui package, endpoint, schema, worker ou front de produto \|

> L41: - [Referência](REFERENCIA-TECNICA.md): scripts, funções e limites verificáveis, sem inventar API ou banco.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA DOCUMENTAL ESTÁTICA PARCIAL — 12/11/2026.** Fonte examinada no commit `068954a21e3090c7f94d374e2a8486cec7c2537b`. G03 é governança de engenharia, com owner `AGENTS.md`; **não** possui runtime NestJS, endpoint, schema ou API própria.

> L29: **G03 não expõe APIs HTTP, schema GraphQL nem eventos do Event Bus do Syndes.** GitHub REST/Projects são integrações externas do sincronizador, não interfaces públicas do produto.

> L38: **Não existe frontend G03 operacional.** O site Syndes Docs é interface de leitura da documentação. Os botões de propor atualização enviam rascunho para revisão ou edição via GitHub conforme permissões, não são endpoints de modificação. O Workspace e o Manager são interfaces do produto com owners distintos.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **G03 não publica APIs HTTP, classes NestJS, eventos de negócio nem esquema SQL.** Seus contratos são políticas e formatos de governança.

> L9: \| **Superfície pública** \| `package.json#exports`, contratos tipados/HTTP/eventos e owner respectivo \| Dependente consome interface pública; não importar `src/` privado \|

> L26: - **API** exige identidade, membership/tenant, autorização por recurso e estado ENABLED.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
