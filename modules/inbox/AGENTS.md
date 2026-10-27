# AGENTS.md — Inbox

## Missão

Fornecer atendimento humano compartilhado e histórico de conversas, sem tentar reproduzir um contact center completo.

## Escopo MVP

- Conversation;
- Message;
- Assignment;
- Status;
- Attachments;
- Realtime;
- Human handoff;
- histórico.

Fluxo: receber → visualizar → atribuir → responder → acompanhar.

## Dependências

- Core CRM para identidade canônica de cliente.
- Platform Core para tenancy/auth.
- Canais fornecem mensagens via contratos; Inbox não depende diretamente de whatsmeow/email provider.

## Não fazer

- voice contact center;
- SLA sofisticado;
- workforce management;
- QA de atendentes;
- dashboards avançados;
- automações genéricas.

## Segurança

- conversa sempre escopada ao tenant;
- attachments autorizados;
- WebSocket/realtime deve validar tenant e usuário;
- nenhum ID externo pode selecionar tenant.

## Testes

- message ordering/idempotency;
- assignment;
- status;
- realtime isolation;
- attachments;
- handoff;
- cross-tenant denial;
- reconnect/retry onde aplicável.
