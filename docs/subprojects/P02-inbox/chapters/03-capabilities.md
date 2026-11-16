## 3. Capabilities — inventário de código e estado

> **16/11/2026 · evidência declarativa do repositório**. Não interpretar como deploy, homologação ou requisito aprovado. [Ficha Mestre](../FICHA-MODULO.md) e [matriz por ação](../MATRIZ-ACOES.md).

| Capacidade de domínio | Código e contrato | Status evidenciado |
|---|---|---|
| Fila, filtros e busca | `InboxService.list`, GET `/conversations`, queue/scope/q/offset | Código identificado; E2E real pendente |
| Métricas | `InboxService.metrics`, GET `/metrics` | Código identificado, grants reais pendentes |
| Criar e consultar conversa | `InboxService.create/get`, SQL Inbox + FK CRM | Código identificado, migrações em alvo pendentes |
| Mensagens e histórico | `InboxService.messages`, GET /messages, histórico do canal via port P03 | Código identificado; provider não homologado |
| Atribuição e operação | `assign`, `status`, `handoff`, `transferWorkspace` | Código identificado; negativas/workspace reais pendentes |
| Notas internas | `InboxService.note`, message internal | Código identificado; UI real pendente |
| Resposta local e WhatsApp | `InboxHost.reply`, `InboxService.reply`, port `SYNDES_WHATSAPP_REPLY` opcional | Enfileiramento WA não comprova entrega |
| Favoritos e não lidas | `favorite`, `markRead` em conversas WhatsApp | Campos exigem migrations posteriores à base 001 |
| Vínculo CRM | `linkContact` + `InboxCrmPersonResolvedConsumer` | Manual + evento, política CRM, sem merge |
| WhatsApp inbound opt-in | `InboxWhatsAppReceivedConsumer.handle` | Consumer identificado, worker/cutover pendente |
| Atualização SSE | `InboxChangeBus`, GET /events, invalidation sem PII | In-memory, não broker distribuído |
| Simulador seguro | `SimulatedChannelAdapter`, POST simulator/inbound | JWT obrigatório; não é webhook anônimo |
| Frontend | `apps/workspace-web/src/features/inbox.tsx` | Código presente; UX em browser autenticado pendente |
| Funil/protocolo/etapas P05 | Outro owner (`modules/service-management`) | **NÃO SE APLICA** ao ownership P02 |

## Capabilities futuras não aprovadas pelo inventário

Não ativar automaticamente fluxo multi-org irrestrito, canal de mídia, novos webhooks públicos, push WebSocket, SSE multi-host, workflow de revisão humana, canal WhatsApp em produção ou protocolo P05 só por aparecer em diagramas. Todo avanço depende de decisão, migrations, grants, testes e deploy auditados.

**Validações anteriores:** STATUS registra 34 PASS locais históricos em 12/11, não repetidos aqui. [Inventário técnico](../INVENTARIO-TECNICO.md) traz recursos FGA, dados e evidências.
