---
title: "P14 · Configuração e ambiente"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Configuração e ambiente

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/REFERENCIA-TECNICA.md)

> L27: \| `TrustedTenantDatabaseProvider`, `TrustedTenantTransactionProvider` \| Porta query-only vs. conexão pinned com `withTransaction` para efeitos atômicos \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L27: **P14 não é um processo extra.** A04 importa interfaces de A08 e carrega plugins confiáveis listados em `apps/core-host/config/modules.json`: CRM, Inbox, WhatsApp, Organizations e Support. O pacote `@syndes/service` é dependência de build, mas não está nesse manifesto fixo. A configuração não cria perfis selecionáveis por instância.

> L88: - **Configuração implementada:** `apps/core-host/config/modules.json` fixo, runtime secrets/oidc/FGA configurados pelo Host. Valores de credenciais, URLs internas e grants reais **não** devem ser publicados.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
