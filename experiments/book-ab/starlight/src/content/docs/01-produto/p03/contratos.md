---
title: "P03 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)

> L7: Pacote TypeScript com contas, outbox, inbound, dispatch, contratos e migrations 001–008; gateway Go/Whatsmeow existe. O plugin consta em apps/core-host/config/modules.json, mas a inscrição não prova módulo habilitado por tenant nem projetor novo operacional.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/REFERENCIA-TECNICA.md)

> L8: - **Owner:** declarado em `catalog/work-units.json`. Contratos públicos de outros owners não podem ser alterados diretamente.

> L34: **A AUDITAR:** inspecionar código e testes, assinaturas, parâmetros, efeitos e erros. Não publicar API privada como contrato.

> L68: - **Próximo passo:** auditar classes/exports, contratos, telas, tabelas, testes e evidências sem inventar funcionalidades.

> L76: \| Plugin NestJS e domínio TypeScript \| `modules/whatsapp/src/plugin.ts` e `modules/whatsapp/src/` \| APIs, contas, contratos, regras, outbox e migrations de negócio \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/OPERACAO.md)

> L16: - [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L39: O processo gerencia sessões e a comunicação WhatsApp; a API TypeScript atende aos contratos de negócio. A troca entre processos precisa de autenticação interna e callbacks protegidos. O armazenamento de sessões do sidecar é separado dos dados de negócio do Tenant DB. Não expor a API do sidecar diretamente à internet.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/04-contratos-e-dependencias-publicas.md)

> L4: - Bibliotecas permitidas: consultar exports públicos e dependências existentes, sem copiar implementação privada.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
