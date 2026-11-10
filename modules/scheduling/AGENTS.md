# AGENTS.md — Scheduling

## Missão

Fornecer agenda operacional simples para pessoas, empresas, responsáveis e para a AI N1.

## Escopo

- availability;
- appointment;
- responsible employee;
- create;
- query;
- reschedule;
- cancel;
- reminders;
- links com Person/Organization.

## Não fazer

- substituir Google Calendar;
- calendaring corporativo completo;
- recursos pós-MVP de integração Google.

## Regras

- impedir conflitos conforme política definida;
- operações sensíveis da IA usam tools autorizadas;
- cancelamento/reagendamento deve ser auditável;
- timezone deve ser explícito na implementação.

## Testes

- availability;
- overlaps;
- create/reschedule/cancel;
- permissions;
- tenant isolation;
- reminder scheduling/idempotency;
- AI tool contract quando PRD-005 existir.

## Contrato transversal de módulos, schemas e metering (2026-11-10)

- Módulo possui schema PostgreSQL próprio nomeado pelo ID curto, após a fase de migração aprovada. Nenhum módulo controla schemas/tabelas de outros ou altera o Control DB por acesso direto. Integração entre módulos ocorre por API/contrato/eventos ou views de leitura aprovadas com dependências declaradas.
- Acesso depende de identidade Keycloak, membership tenant/org/workspace quando aplicável, habilitação no catálogo do Control Plane e OpenFGA; não utilizar `tenant_id` enviado pelo browser como autoridade. Desativar módulo não apaga dados. Migrações apenas por instalador aprovado e testes PG17 descartáveis.
- Se houver medição de uso necessária, declarar a métrica e sua fonte com idempotência; não atribuir preço, cobrar por retries nem implementar Billing/Payments dentro do domínio. O PRD-009 de Subscription & Billing continua posterior ao núcleo operacional.
- Consultar `AGENTS.md` da raiz, `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md` e WBS/ADR da PR #65; não declarar schema migrado antes de comprovação SQL/Host/testes.