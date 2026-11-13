---
title: "C04 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA + CONTAINER UP — 13/11/2026.** Base `2e1707c`. Atribuir ao C04 somente o modelo/provedor, não APIs/classes pertencentes aos consumidores. Nenhuma consulta de stores, grants, modelos ativos, tokens ou dados privados foi realizada.

> L62: - O armazenamento técnico do OpenFGA utiliza PostgreSQL conforme Compose (service `openfga-migrate` e `openfga`). **Não** atribuir suas tabelas às migrations de tenant ou à outbox Control.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L17: **Persistência:** OpenFGA usa PostgreSQL próprio de serviço conforme Compose; `fga-model.json` não é migration SQL Tenant nem Control. `openfga-migrate` pertence à inicialização operacional do provedor.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
