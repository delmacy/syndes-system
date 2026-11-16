## 4. Contratos e dependências públicas — conciliação

> **16/11/2026 · código `24018b354392`.** Os contratos abaixo são identificados na fonte, não necessariamente instalados. Para detalhes de cada ação, consulte [19 fichas A–J](../MATRIZ-ACOES.md), [inventário](../INVENTARIO-TECNICO.md) e [STATUS](../STATUS.md).

## API HTTP do Inbox

**Base:** `/v1/tenants/:tenantId/inbox`. São **17 decorators** no `InboxController` (GET, POST, PATCH), organizados por fila, conversa, mensagens, operação, CRM, histórico, simulação e SSE. Cada ação possui entrada, recurso/permissão, origem, tratamento de erros e edge cases descritos na [matriz](../MATRIZ-ACOES.md). O controller declarado não garante Host montado ou rota disponível em produção.

## Contratos públicos do pacote

`package.json#exports` expõe `@syndes/core-inbox` e `@syndes/core-inbox/plugin`. Consultar `src/index.ts` para símbolos exportados, não importar classes privadas apenas por estarem presentes em `src`. O plugin `src/plugin.ts` declara recurso/ação FGA, migration `001_inbox_foundation` e assets legados, mas não provisiona grants ou aplica SQL automaticamente.

## Eventos assíncronos versionados

| Evento | Producer → consumer | Responsabilidade |
|---|---|---|
| `whatsapp.message.received.v2` | P03 → `InboxWhatsAppReceivedConsumer.handle` | Ler raw via port, upsert idempotente de conversa/mensagem na mesma tenant tx |
| `inbox.participant.observed.v1` | P02 → CRM P01 | Notificar participante em conversa individual no escopo; não criar Person |
| `crm.person.resolved.v1` | CRM P01 → `InboxCrmPersonResolvedConsumer.handle` | Revalidar pessoa e vincular sem sobrescrever divergência |
| SSE `changed` | P02 → A01 Workspace | Invalidação efêmera, sem corpo de conversa/PII; reconsulta REST |

Publisher de eventos é diferente de SSE; entrega assíncrona depende de C06/worker opt-in não homologado. `review_required` pertence à política CRM, **não** equivale a um vínculo aplicado na Inbox.

## Dependências e permissões

| Dependência | Necessidade |
|---|---|
| A04 Host, A08 Core Kernel | JWT, provider Tenant DB, plugin, Kernel authorization |
| C03 Keycloak e C04 OpenFGA | Actor, membership e grants por recurso |
| C01/P04 Organizations & Workforce | tenant/org/workspace, equipes e validação de transfer |
| P01 CRM | Person, vínculo e identidade; `crm:people/read` adicional |
| P03 WhatsApp | roteamento, provider, histórico, outbound; `whatsapp:accounts/read` adicional |
| C06 Platform Events | transação, outbox, consumers e replay opt-in |
| A01 Workspace / P05 Gestão de Atendimentos | UI e Inspector de protocolo sob owner externo |

Headers de seleção `x-syndes-organization-id` e `x-syndes-workspace-id` não são autorização: devem ser verificados com memberships e FGA. Recurso `inbox:assignment/write` não é o alias de README antigo `inbox:conversations/assign`.

## Testes e compatibilidade

Antes de alterar endpoint/DTO/port/payload/SQL, mapear consumidores e versões, validar negativos 401/403/409/503, isolamento A/B e concorrência/idempotência. As mudanças em código, WBS, STATUS e estas fichas devem ser feitas no mesmo incremento. **Este capítulo não aprova implementações.**
