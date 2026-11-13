---
title: "C04 · Configuração e ambiente"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Configuração e ambiente

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline de código: `2e1707c`; revisão de arquivos e inspeção de containers **somente leitura** no DevServer01. **Não foram consultadas tuples reais, stores, usuários nem tokens.** Nenhuma configuração, grant, migration, serviço ou banco foi alterado. Homologação, staging e produção **não verificados**.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/REFERENCIA-TECNICA.md)

> L9: \| Serviço OpenFGA v1.22.1 \| `infra/security-access/compose.yaml` \| `openfga-migrate` executa migration do serviço; `openfga` usa arquivo de configuração privada e redes internas \|

> L62: - O armazenamento técnico do OpenFGA utiliza PostgreSQL conforme Compose (service `openfga-migrate` e `openfga`). **Não** atribuir suas tabelas às migrations de tenant ou à outbox Control.

> L65: - Testes: `apps/core-host/test/adapters.test.mjs`, `platform-event-service-grant.test.mjs`, `platform-event-service-grant-fga.test.mjs`, `apps/account-access-api/test/auth.test.mjs`. Incluem negativas e instância in-memory/descartável, não configuração runtime persistente.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L17: **Persistência:** OpenFGA usa PostgreSQL próprio de serviço conforme Compose; `fga-model.json` não é migration SQL Tenant nem Control. `openfga-migrate` pertence à inicialização operacional do provedor.

> L19: **Configuração e redes:** arquivo runtime privado montado pelo Compose, sem publicar valores de store, tokens, URLs, endereços internos ou tuples. Container Up não significa modelo instalado. **Frontend:** não existe tela C04; enforcement pertence aos backends.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
