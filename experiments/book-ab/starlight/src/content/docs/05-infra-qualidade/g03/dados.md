---
title: "G03 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/REFERENCIA-TECNICA.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/04-contratos-e-dependencias-publicas.md)

> L27: - **DDL e dados** pertencem ao módulo dono do schema e ao instalador/operador; G03 não executa migrations.

> L28: - **UI compartilhada** fica em `packages/front-shared` apenas para apresentação; regras de sessão e dados continuam separadas.

> L30: **Dependências da G03:** AGENTS globais/locais, Git, catálogo, WBS/Issues, CI, documentação e políticas de segurança. Não há dependência de runtime PostgreSQL ou de credenciais da operação do produto.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L35: - **G03 não usa banco de dados próprio.** O registro de alteração é Git e a documentação Markdown; tarefas/estado vivo são serviços GitHub quando conectados e autorizados.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
