## 4. Catálogo de capabilities propostas para rastreabilidade

Os IDs abaixo são **IDs de documentação candidatos**, não IDs já aceitos por uma API de capability. Validar com contratos reais antes de torná-los públicos.

| ID | Capability | Essencial / opcional | Propriedade | Contrato/artefato | Marco |
|---|---|---|---|---|---|
| P01-CAP01 | Pessoa: CRUD, busca e archive | Essencial | CRM | `contracts.ts`, `crm.controller.ts` | P01-M01 |
| P01-CAP02 | Organização de cadastro e relacionamentos | Essencial | CRM | `contracts.ts`, `postgres.ts` | P01-M01 |
| P01-CAP03 | Tags e classificações | Essencial | CRM | `extra.ts`, `postgres.ts` | P01-M01 |
| P01-CAP04 | Notas, timeline e auditoria | Essencial | CRM | `contracts.ts`, `extra.ts` | P01-M01 |
| P01-CAP05 | Normalização, busca e detecção de possíveis duplicados | Essencial | CRM | `validation.ts`, `crm.controller.ts` | P01-M01 |
| P01-CAP06 | CSV com limites e proteção contra fórmulas | Essencial | CRM | `csv.ts`, `crm.controller.ts` | P01-M01 |
| P01-CAP07 | ChannelIdentity vinculada à Person | Essencial no MVP de canais | CRM (referência, não sessão) | `extra.ts`, SQL 003 | P01-M02 |
| P01-CAP08 | EmployeeProfile associado à Person | Existente; integração Workforce opcional | CRM perfil, P04 diretório operacional | SQL 003, `extra.ts` | P01-M02 |
| P01-CAP09 | Contexto Organization/Workspace e seleção segura | Opcional conforme configuração aprovada | P04/Control | `context-guard.ts`, `scope-query.ts` | P01-M03 |
| P01-CAP10 | Reconciliação de identidade WA→CRM e review_required | Integração opcional | CRM + P03/P02/C06 | `whatsapp-identity-events.ts` | P01-M03 |
| P01-CAP11 | UI CRM no Workspace com capacidades efetivas | Essencial para aceite do produto | A01 + CRM API | `apps/workspace-web/src/features/crm*.tsx` | P01-M04 |

### Regra de progressão

Cada capability tem separadamente: **declaração, código, teste, integração, disponibilidade, autorização e aceite**. O estado de cada uma pertence ao `STATUS.md`.

O CRM pode possuir código de EmployeeProfile ou estrutura contextual sem ativar integrações Workforce/multi-org. **Não** eliminar nem ativar automaticamente tais capacidades. Dependências obrigatórias do manifesto `ModuleRegistry` e dependências opcionais de uma operação não são equivalentes.

### Depreciação ou redução

Antes de retirar ou alterar uma capability/coluna/endpoint/evento:
1. Mapear consumidores (Workspace, Inbox, WhatsApp, Service, workers, SQL e versões antigas).
2. Definir versão substituta e comportamento de convivência.
3. Migrar consumidores usando expand → migrate → contract; manter leitura de dados históricos.
4. Executar testes de compatibilidade, migrações e recuperação no ambiente autorizado.
5. Aprovar a remoção expressamente. Desabilitar uma UI ou flag **não** equivale a remover contrato ou apagar dados.

---
