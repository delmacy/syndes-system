---
title: "C01 · Eventos e mensageria"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Eventos e mensageria

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)

> L16: \| **Eventos Control** \| `control_events.outbox_events/deliveries/consumer_inbox` **ausentes** \| Evento v1 é contrato no código, não dispatcher ativo \|

> L29: 5. **P1 — Control events não instalado:** SQL/trigger disponíveis no Git, sem tables/dispatcher/consumer autorizados neste ambiente; tenant outbox é outro plano de dados.

> L55: \| 13/11/2026 04:38Z \| DevServer01, `syndes_control`, somente leitura \| Registry, Manager base, um tenant ativo; catálogo/roles/eventos ausentes, 6 PENDING \| Dados de clientes, Product Gate, backup/restore, staging \|

> L58: **Status: auditoria técnica parcial de C01; esquema Control base presente, camada de módulos/eventos não instalada na instância examinada. Próxima unidade documental: C03 — Identity Keycloak.**

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/REFERENCIA-TECNICA.md)

> L16: \| C06 \| `infra/postgres/bootstrap/control-module-events.schema`, `apps/core-host/src/platform-event-*.ts` \| Eventos de administração em Control separados dos eventos de domínio em tenant \|

> L58: O `control-plane-events.ts` do Kernel define **dois envelopes v1**: `platform.module.entitlement.changed.v1` e `platform.module.installation.changed.v1`. O `control-module-events.schema` escreve outbox através do trigger `control_events.enqueue_module_audit()` após INSERT no log append-only `tenant_module_audit`, mantendo o mesmo commit PostgreSQL. `event_deliveries` e `consumer_inbox` dão suporte a tentativas, lease

> L60: Essa infraestrutura consta do **SQL versionado**, mas foi constatado que o schema `control_events` não está instalado na instância. **Nenhum dispatcher Control foi homologado ou ativado por este trabalho.** A outbox tenant-local de CRM/Inbox/WhatsApp em `platform_events` possui owner e gates separados.

> L73: \| 006_control_events \| Outbox Control \| PENDING \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/OPERACAO.md)

> L43: No snapshot de 13/11/2026, informou **seis migrations PENDING** e `PLAN ONLY: no Control DB changes`; não criou ledger ou schema. A auditoria de catálogo usou `BEGIN TRANSACTION READ ONLY` e agregados sem UUID, principal, evento, PII, tokens ou credenciais.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/04-contratos-e-dependencias-publicas.md)

> L38: - **Origem normativa:** trigger `control_events.enqueue_module_audit()` após INSERT de `public.tenant_module_audit`; outbox no **mesmo commit** do Control. `auditEventId` e `correlationId` identificam causalidade, sem payload de mensagens.

> L40: - **Não confundir** com a outbox `platform_events` nos DBs dos tenants (CRM/Inbox/WhatsApp) ou com workers ativos; CP-G02/03 continuam bloqueados/pendentes.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L78: `control_events` foi projetado com outbox, delivery e inbox no **banco Control**, recebendo dados de `tenant_module_audit` na mesma transação. Esse schema contém fatos administrativos de entitlement/instalação, não mensagens. Por outro lado, `platform_events` é schema do **tenant DB**, para eventos dos módulos. A disponibilidade de contrato v1 ou teste PG17 sintético não autoriza dispatcher/control worker ou envio de

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
