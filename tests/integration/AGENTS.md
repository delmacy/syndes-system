# AGENTS.md — Integration Tests

## Missão

Cobrir contratos entre domínio, persistência e adapters.

## Prioridade ao longo do MVP

1. Core CRM + tenant database.
2. Inbox + CRM.
3. WhatsApp + Inbox.
4. Scheduling + CRM.
5. AI tools + CRM/Inbox/Scheduling.
6. Documents/Email.
7. Onboarding/Provisioning.
8. Billing/Entitlements.

## Regras

- Toda integração externa deve possuir caminho de mock/fake para CI determinístico.
- Testes devem provar erros e timeouts, não apenas happy path.
- Qualquer integração que transporte tenant context deve testar isolamento.
- Migrations e persistência devem ser exercitadas em banco descartável quando o código existir.
