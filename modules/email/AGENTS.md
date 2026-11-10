# AGENTS.md — Email

## Missão

Integrar uma caixa de e-mail ao fluxo de atendimento, sem criar um cliente de e-mail completo.

## Escopo

- receber;
- correlacionar contato;
- criar/atualizar conversa na Inbox;
- responder;
- manter headers/ids necessários para threading.

## Não fazer

- cliente completo de e-mail;
- campanhas;
- marketing email;
- múltiplas caixas no Basic inicial.

## Segurança

- secrets fora do domínio;
- sanitização de conteúdo;
- attachments passam pelas regras de Documents/Inbox;
- tenant isolation;
- prevenção de spoofing/confusão de identidade dentro dos limites possíveis.

## Testes

- inbound;
- outbound;
- threading;
- duplicate event;
- attachment;
- auth failure;
- tenant isolation;
- retry.

## Contrato transversal de módulos, schemas e metering (2026-11-10)

- Módulo possui schema PostgreSQL próprio nomeado pelo ID curto, após a fase de migração aprovada. Nenhum módulo controla schemas/tabelas de outros ou altera o Control DB por acesso direto. Integração entre módulos ocorre por API/contrato/eventos ou views de leitura aprovadas com dependências declaradas.
- Acesso depende de identidade Keycloak, membership tenant/org/workspace quando aplicável, habilitação no catálogo do Control Plane e OpenFGA; não utilizar `tenant_id` enviado pelo browser como autoridade. Desativar módulo não apaga dados. Migrações apenas por instalador aprovado e testes PG17 descartáveis.
- Se houver medição de uso necessária, declarar a métrica e sua fonte com idempotência; não atribuir preço, cobrar por retries nem implementar Billing/Payments dentro do domínio. O PRD-009 de Subscription & Billing continua posterior ao núcleo operacional.
- Consultar `AGENTS.md` da raiz, `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md` e WBS/ADR da PR #65; não declarar schema migrado antes de comprovação SQL/Host/testes.