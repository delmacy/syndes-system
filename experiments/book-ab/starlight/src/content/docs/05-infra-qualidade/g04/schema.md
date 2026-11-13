---
title: "G04 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G04-privacidade/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G04-privacidade/REFERENCIA-TECNICA.md)

> L27: Tabelas e migrações precisam de ownership e prova de aplicação; arquivo SQL presente não equivale a mudança executada.

> L29: Nenhuma migration em subpasta SQL nesta fonte; isso **não** comprova ausência de persistência.

> L33: Nenhuma tabela pode ser atribuída ao Control por inferência; confirmar owner e schema. Negócio do cliente fica no Tenant DB.

> L38: - **Próximo passo:** auditar classes/exports, contratos, telas, tabelas, testes e evidências sem inventar funcionalidades.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G04-privacidade/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G04-privacidade/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G04-privacidade/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L2: - Componentes, ownership de dados, migrations e autorização: A VERIFICAR.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G04-privacidade/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
