# CRM-05 — Schema CRM e Organizations/People/Relationships/Employee

- **Módulo/gate:** Core CRM API / Sprint 2.
- **Classificação:** MVP.
- **Prioridade/estado:** P0 / depende de CRM-03/04 e Platform Core gate.
- **Responsável recomendado:** OpenCode Free; Codex revisa.
- **Issue/branch/commit/PR:** ainda não criados; esta é uma ordem local, sem operação externa.

## Objetivo e escopo

Criar tenant baseline migration e implementar persistência/API segura para Organization, Person, Relationship e Employee, seguindo a semântica de Employee congelada em CRM-00.

## Incluído

- Modelo Drizzle tenant separado do Control Plane, constraints/indexes necessárias e migration revisada.
- CRUD/list/detail/archive Organization/Person; Relationship Person ↔ Organization; Employee is a tenant staff/attendant profile with stable ID, active status, and optional unique Control Plane actor ID. Employee is not a login and stores no credentials.
- Apply `customer_scope` consistently: `cpf` sees Persons without a PJ Organization link; `pj` sees Organizations plus linked contact Persons; `both` sees both. `tenant_admin` manages member scopes and has full CRM access; `tenant_member` cannot archive/export.
- All attendants use the same CRM UI; employee profiles and memberships remain distinct (`Employee != UserAccount`).
- Todas operações usam `TenantContext`, server-side authorization e audit relevante.
- Unit tests de domínio/validation e PostgreSQL integration tests de CRUD, constraints, migration de zero, autorização, customer-scope filtering e isolamento A/B.

## Excluído

- UI, pipeline/deals, custom fields avançados, hard delete, merge automático, channel sync.

## Dependências e ownership

- Depende de CRM-03/04, migrations runner tenant e decisões CRM-00.
- Permitidos: `apps/api/src/modules/core-crm/{organizations,people,relationships}/**`, `apps/api/drizzle/tenant/**`, seus testes e module wiring explícito.
- Proibidos: Platform Core internals, Next.js, tags/notes/search/CSV (tasks posteriores), migration Control Plane sem coordination.
- Contrato de API deve manter IDs tenant-scoped e errors aprovados.

## Aceite e encerramento

- CRUD/ref/relationship constraints, Employee semantics e archive provados; foreign tenant IDs não acessíveis.
- Migration do zero e validação de invalid input provadas em DB descartável.
- Testes relevantes junto à implementação; package checks verdes. E2E frontend não aplicável.
- Evidências sanitizadas; próximo owner: Codex review; depois CRM-06.
