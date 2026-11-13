---
title: "P03 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)

> L23: - Go/Whatsmeow: testes de gateway e persistência/quotas/contas não validados nesta auditoria.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/REFERENCIA-TECNICA.md)

> L63: Nenhuma tabela pode ser atribuída ao Control por inferência; confirmar owner e schema. Negócio do cliente fica no Tenant DB.

> L79: **Banco:** as sessões do Whatsmeow utilizam armazenamento PostgreSQL dedicado ao adaptador, conforme seu README. É distinto do **Tenant DB** (contas/mensagens de negócio) e do **Control/Manager DB**. Não pressupor migrations já aplicadas.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/OPERACAO.md)

> L39: O processo gerencia sessões e a comunicação WhatsApp; a API TypeScript atende aos contratos de negócio. A troca entre processos precisa de autenticação interna e callbacks protegidos. O armazenamento de sessões do sidecar é separado dos dados de negócio do Tenant DB. Não expor a API do sidecar diretamente à internet.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L8: - TypeScript: `modules/whatsapp/src/plugin.ts`, `inbound-http.ts`, `outbox.ts`, `event-bridge.ts` — contrato, conta, rotas e persistência do módulo.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
