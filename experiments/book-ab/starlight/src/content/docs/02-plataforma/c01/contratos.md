---
title: "C01 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)

> L16: \| **Eventos Control** \| `control_events.outbox_events/deliveries/consumer_inbox` **ausentes** \| Evento v1 é contrato no código, não dispatcher ativo \|

> L28: 4. **P1 — Account roles/delegação ausentes:** tabelas/funções do contrato Account não confirmadas; dependências da A06/FGA reais precisam de gate próprio.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA E SQL SOMENTE LEITURA — 13/11/2026.** Base `origin/main` SHA `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`. Snapshot PostgreSQL DevServer01 `2026-11-13T04:38:21Z`. **C01 é uma fronteira distribuída de dados/contratos globais, não um serviço isolado.** Não foram consultados dados pessoais nem executados migrations, grants, escrita, restore ou deploy. Produção e staging não verificados.

> L12: \| A08 \| `packages/core-kernel/src/module-catalog.ts`, `module-lifecycle.ts`, `module-access.ts`, `control-plane-events.ts` \| Portabilidade e envelopes tipados; não um SDK npm público \|

> L15: \| A06 \| `apps/account-access-api/src/server.mjs`, `main.mjs` \| Delegação de roles de Account com FGA; contrato SQL `control-account-delegation.schema` \|

> L51: \| A04 Host \| `PgModuleInstaller`, `PgControlInstallAttestor`, `PgControlModuleActivator` \| Contratos de operação trusted, não endpoints de provisionamento público \|

> L66: \| Etapa \| Contrato \| DevServer01 \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/OPERACAO.md)

> L16: - [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **C01 não é um pacote com `export` próprio nem um serviço HTTP específico.** As APIs reais pertencem a A04/A05/A06 e as interfaces portáveis pertencem a A08. O contrato primário do C01 é o **schema Control versionado e suas regras de transição**.

> L7: \| Fonte \| Entidade/contrato \| Efeito e situação \|

> L44: O host público **não recebe** SQL de migration nem nomes de databases fornecidos pelo cliente. Modificar Control schema/roles exige owner, revisão de segurança, ledger/checksum, backup e restore, SHA, janela e teste. Esta auditoria preserva todos os contratos executáveis, sem aplicar DDL.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
