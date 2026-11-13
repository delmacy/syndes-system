---
title: "Q01 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)

> L10: \| **Implementação** \| Scripts reais em `tests/platform` e `tests/integrity`, AGENTS em integration/security/performance; testes também em modules/apps \| Sem backend/API/schema/frontend exclusivo de Q01; nem todo AGENTS tem runner \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/REFERENCIA-TECNICA.md)

> L31: **Q01 não publica endpoints HTTP, contratos OpenAPI, eventos do Event Bus, classes de domínio, exports de package ou schemas/migrations próprios**. O contrato com o CI é **executar testes e emitir exit code/resultado**, correlacionados ao SHA, job, ambiente e negativa verificada. APIs e objetos SQL testados pertencem a suas unidades de runtime.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **Q01 não expõe endpoints HTTP, package exports, eventos de negócio, controllers, migrations nem classes de domínio.** Seus contratos observáveis são arquivos de teste, comandos, exit codes, fixtures e resultados dos jobs executados por Q07.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L29: \| Teste PG17 descartável \| Persistência/roles/tenant, Serviço e migrations \| Container efêmero, portas restritas/labels, cleanup \| Migration de produção aplicada \|

> L37: `Control Plane` mantém registry, roles e escopo global; cada `tenant database` é isolado. Os testes de PostgreSQL exercitam proibição de conexões indevidas e provisionamento de fixture, mas não criam dados permanentes da Q01. Os testes de OpenFGA validam grants simulados de A/B; os de Keycloak usam identidades descartáveis. **Q01 não cria database, tabela nem migration próprias.**

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
