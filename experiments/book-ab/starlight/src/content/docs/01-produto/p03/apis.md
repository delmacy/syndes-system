---
title: "P03 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/REFERENCIA-TECNICA.md)

> L34: **A AUDITAR:** inspecionar código e testes, assinaturas, parâmetros, efeitos e erros. Não publicar API privada como contrato.

> L77: \| Sidecar Go / Whatsmeow \| `modules/whatsapp/gateway/whatsmeow/` \| Protocolo WhatsApp, sessões e callbacks autenticados para a API \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/OPERACAO.md)

> L39: O processo gerencia sessões e a comunicação WhatsApp; a API TypeScript atende aos contratos de negócio. A troca entre processos precisa de autenticação interna e callbacks protegidos. O armazenamento de sessões do sidecar é separado dos dados de negócio do Tenant DB. Não expor a API do sidecar diretamente à internet.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L8: - TypeScript: `modules/whatsapp/src/plugin.ts`, `inbound-http.ts`, `outbox.ts`, `event-bridge.ts` — contrato, conta, rotas e persistência do módulo.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
