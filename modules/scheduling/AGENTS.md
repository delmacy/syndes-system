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
