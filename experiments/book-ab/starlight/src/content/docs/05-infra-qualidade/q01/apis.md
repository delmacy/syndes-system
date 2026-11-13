---
title: "Q01 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)

> L10: \| **Implementação** \| Scripts reais em `tests/platform` e `tests/integrity`, AGENTS em integration/security/performance; testes também em modules/apps \| Sem backend/API/schema/frontend exclusivo de Q01; nem todo AGENTS tem runner \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/REFERENCIA-TECNICA.md)

> L31: **Q01 não publica endpoints HTTP, contratos OpenAPI, eventos do Event Bus, classes de domínio, exports de package ou schemas/migrations próprios**. O contrato com o CI é **executar testes e emitir exit code/resultado**, correlacionados ao SHA, job, ambiente e negativa verificada. APIs e objetos SQL testados pertencem a suas unidades de runtime.

> L36: - **Frontend:** Q01 não tem frontend, tela, rota ou API. Browser E2E é executado nas suites dos aplicativos Workspace, Support e Manager, sob seus respectivos owners.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **Q01 não expõe endpoints HTTP, package exports, eventos de negócio, controllers, migrations nem classes de domínio.** Seus contratos observáveis são arquivos de teste, comandos, exit codes, fixtures e resultados dos jobs executados por Q07.

> L12: \| `tests/platform/openbao-smoke.sh` \| OpenBao CI + certificado de fixture \| Health/TLS, init/unseal e API de secretos \| **Unseal 1-of-1 é exclusivo de CI**, não exemplo de configuração produtiva \|

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L46: - Não há API ou frontend da Q01; as telas do portal servem para consultar evidência, não controlar infraestrutura ou alterar permissões.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
