# WBS — OpenFGA Service Event Grants (2026-11-11)

| ID | Entrega | Estado |
|---|---|---|
| EV-FGA01 | Tipo `service` e recurso `event_delivery` isolados das permissões de usuário | Código aditivo implementado |
| EV-FGA02 | Relação `processor → can_process` apenas para service | Código/teste OpenFGA real descartável |
| EV-FGA03 | Objeto hash tenant/org/workspace/módulo/consumer/eventType | Implementado e testado |
| EV-FGA04 | Adapter Host `OpenFgaServiceEventGrant` com timeout, identidade confiável e fail closed | Implementado, testes unitários |
| EV-FGA05 | Smoke isolado de grant/revogação/cross-tenant, mantendo legado `can_write` | Testado em store descartável |
| EV-FGA06 | ADR e AGENTS | Documentado |
| EV-FGA07 | Evoluir store de staging e fixar model ID com revisão/rollback | **Pendente — autorização explícita** |
| EV-FGA08 | Provisionar principal de serviço e tuples aprovadas | **Pendente — credenciais e política operacional** |
| EV-FGA09 | Habilitar Worker apenas após Control ENABLED, staging restore e scheduler seguro | **Bloqueado** |
| EV-FGA10 | Cutover do WhatsApp textual e smoke de frontend | **Bloqueado — Product Gates** |

Nenhuma alteração em GitHub Actions, domínio de dados tenant, Control DB, Docker do serviço OpenFGA operacional, frontend ou SQL002 é parte desta entrega.
