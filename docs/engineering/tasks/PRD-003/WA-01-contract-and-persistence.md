# WA-01 — Contrato e persistência WhatsApp

- Owner: API/Platform
- Escopo: conexão por tenant, estados, migrations e isolamento.
- Fora: provider, UI e webhook.
- Aceite: unicidade de uma conexão Basic, tenant routing server-side, migrations descartáveis e testes de autorização/isolamento.

## Implementação inicial

- Configuração `WHATSAPP_*` criada com listener privado `127.0.0.1:18083` por padrão.
- Contrato de estado e schema `whatsapp_connections` criados; singleton por banco de tenant.
- Migrations e módulo Nest registrados no `AppModule`.
- Evidência: API typecheck, build e suíte unitária verdes (`52 suites`, `354 tests`).
- Próxima lacuna: integração real do adapter e endpoint autenticado de configuração.
