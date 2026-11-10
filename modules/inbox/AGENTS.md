# AGENTS.md — Inbox

## Estado

**MÓDULO EM DESENVOLVIMENTO — PRD-002 (prioridade a partir de 2026-11-01).** O CRM mantém pendências de frontend abertas por decisão explícita do responsável pelo produto. Não declarar Inbox concluída antes de realtime seguro, anexos, aceite Keycloak/OpenFGA real e testes de isolamento.

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

## Contrato transversal de módulos, schemas e metering (2026-11-10)

- Módulo possui schema PostgreSQL próprio nomeado pelo ID curto, após a fase de migração aprovada. Nenhum módulo controla schemas/tabelas de outros ou altera o Control DB por acesso direto. Integração entre módulos ocorre por API/contrato/eventos ou views de leitura aprovadas com dependências declaradas.
- Acesso depende de identidade Keycloak, membership tenant/org/workspace quando aplicável, habilitação no catálogo do Control Plane e OpenFGA; não utilizar `tenant_id` enviado pelo browser como autoridade. Desativar módulo não apaga dados. Migrações apenas por instalador aprovado e testes PG17 descartáveis.
- Se houver medição de uso necessária, declarar a métrica e sua fonte com idempotência; não atribuir preço, cobrar por retries nem implementar Billing/Payments dentro do domínio. O PRD-009 de Subscription & Billing continua posterior ao núcleo operacional.
- Consultar `AGENTS.md` da raiz, `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md` e WBS/ADR da PR #65; não declarar schema migrado antes de comprovação SQL/Host/testes.