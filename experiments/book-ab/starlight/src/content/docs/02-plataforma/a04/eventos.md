---
title: "A04 · Eventos e mensageria"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Eventos e mensageria

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/STATUS.md)

> L13: \| Eventos \| `platform-event-*.ts` \| Sem ativação de dispatcher/worker ou prova de consumo real \|

> L25: \| A04.EVT.01 \| PENDENTE \| Eventos, worker admission, replay, dedupe e outbox por tenant sem tocar runtime \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/REFERENCIA-TECNICA.md)

> L43: - **Eventos:** publisher, dispatcher, worker, admission, batch e grants de serviço são composição de C06 no Host. Nenhum worker foi iniciado neste ciclo.

> L44: - **Frontend:** A04 não tem frontend próprio; Workspace, Manager e Support são consumidores separados. Assets publicados pelos plugins não são um shell universal de autorização.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/04-contratos-e-dependencias-publicas.md)

> L6: - Eventos C06: `OpenFgaServiceEventGrant.canProcess`, `TenantEventWorkerAdmission.authorize`.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L18: - **Eventos:** o worker requer admission e service grant; nenhuma fila/outbox foi ativada nesta auditoria.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
