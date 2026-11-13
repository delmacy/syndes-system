## 3. Capabilities

| Capacidade | Fonte | Evidência |
|---|---|---|
| Modelo relacional 1.1 de usuário, recurso, tenant | `fga-model.json` | Versão no Git; modelo ativo não verificado |
| Relação de processamento exclusiva de serviço | `event_delivery.processor/can_process` | Contrato versionado; tuples reais não verificadas |
| Check usuário `can_read/can_write` | `FgaPermission.canAccess` | Adapter A04 e teste |
| Check Account roles | `createFgaWriteAuthorizer` | Adapter A06 e teste |
| Grant de worker por evento/consumer/scope | `OpenFgaServiceEventGrant.canProcess` | Adapter e teste in-memory |
| Operational health, rotação, backup, rollback | Infra/Runbook | **Pendente de homologação** |

O C04 não possui frontend próprio, nem recebe permissão a partir de tela/claim não confirmado.
