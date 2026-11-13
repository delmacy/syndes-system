---
title: "G03 · Eventos e mensageria"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Eventos e mensageria

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/REFERENCIA-TECNICA.md)

> L29: **G03 não expõe APIs HTTP, schema GraphQL nem eventos do Event Bus do Syndes.** GitHub REST/Projects são integrações externas do sincronizador, não interfaces públicas do produto.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **G03 não publica APIs HTTP, classes NestJS, eventos de negócio nem esquema SQL.** Seus contratos são políticas e formatos de governança.

> L5: \| Contrato de processo \| Produtor/source of truth \| Consumidor e restrição \|

> L9: \| **Superfície pública** \| `package.json#exports`, contratos tipados/HTTP/eventos e owner respectivo \| Dependente consome interface pública; não importar `src/` privado \|

> L18: **Entradas mínimas:** `moduleId`, arquivo/tópico, objetivo aprovado, revisão base, limites, critérios de teste. **Saídas:** diff restrito, testes e comandos/resultados, risco residual, contrato afetado, commit/PR proposto e solicitação separada para consumidor externo.

> L25: - **Evento** versionado é publicado por producer autorizado e consumido por owner de destino, com idempotência, contratos e outbox quando aplicável.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
