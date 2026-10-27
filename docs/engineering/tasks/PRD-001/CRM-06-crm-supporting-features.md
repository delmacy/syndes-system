# CRM-06 — Tags, Notes, Timeline, Archive e ChannelIdentity

- **Módulo/gate:** Core CRM API / Sprint 2.
- **Classificação:** MVP.
- **Prioridade/estado:** P1 / depende de CRM-05.
- **Responsável recomendado:** OpenCode Free; Codex revisa.
- **Issue/branch/commit/PR:** ainda não criados; esta é uma ordem local, sem operação externa.

## Objetivo e escopo

Implementar features de apoio aprovadas sobre as entidades base e deixar seus eventos navegáveis pela timeline.

## Incluído

- Tags e associações autorizadas conforme os alvos congelados em CRM-00.
- Notes vinculadas aos alvos CRM aprovados em CRM-00, auditoria de alterações e ordenação cronológica.
- Timeline composta pelos eventos suportados e definidos em CRM-00, sem criar source of truth duplicada.
- Soft archive/list filtering e restore somente se definido pela política; sem hard delete.
- ChannelIdentity vinculada à Person; metadados externos separados de nomes CRM confirmados.
- Unit/integration tests para ownership, chronology, channel overwrite prevention, archive e tenant isolation.
- Enforce the caller's `customer_scope` on Tag/Note targets, Relationship access, Timeline events, Archive and ChannelIdentity reads/writes; PJ scope includes linked contact Persons.

## Excluído

- Integração real com WhatsApp/outro canal, automações, IA, hard delete e novas entidades além das aprovadas.

## Dependências/ownership

- Depende de CRM-05 e contratos de `TenantContext`, authorization e audit.
- Permitidos: `apps/api/src/modules/core-crm/{tags,notes,timeline,channel-identities}/**` e testes dessas áreas.
- Proibidos: migrations/base feature files CRM-05 sem coordenação, `platform-core/**`, frontend, providers externos.

## Aceite e evidência

- Nenhuma associação ou evento cruza tenant; archive preserva histórico; identidade de canal não sobrescreve nome CRM confirmado.
- Testes unit/integration e checks de package passam; sem E2E frontend.
- Próximo owner: Codex revisão; depois CRM-07/08 (sequenciais se houver overlap de query/contracts).
