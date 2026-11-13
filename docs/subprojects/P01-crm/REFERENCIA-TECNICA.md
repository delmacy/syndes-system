# P01 — CRM | Referência técnica

> **PILOTO · 12/11/2026.** Inventário parcial de interfaces e persistência. Dados profissionais em `crm_employees` são herança arquitetural a reconciliar com Workforce/ERP Lite, **não objeto de migração aprovada**.

## 1. Stack e responsabilidades

- **Owner:** `P01 CRM` · `modules/core-crm`.
- **Stack:** TypeScript 5.9, módulo NestJS `CrmHttpModule`, repositório PostgreSQL e contratos do `@syndes/core-kernel`.
- **Imports permitidos:** `@syndes/core-crm` e `@syndes/core-crm/plugin`; conferir `package.json#exports`.
- **Domínio:** pessoas, empresas de relacionamento, tags, notas, timeline, canal e relação; não organização de tenant.

## 2. Classes e métodos

| Classe / fonte | Método (assinatura resumida) | Efeito / proteção |
|---|---|---|
| `CrmService` — `src/service.ts` | `createOrganization(ctx,input)`, `createPerson(ctx,input)` | Valida e cria entidades CRM, não empresas da plataforma |
| `CrmService` | `linkPerson(ctx,personId,organizationId)` | Vínculo de pessoa com empresa CRM |
| `CrmService` | `getPerson(ctx,id)`, `listPeople(ctx,query,limit,offset)` | Consulta e busca por tenant; limites e validações de paginação |
| `CrmService` | `archivePerson(ctx,id)` | Archive seguro e auditável, não destruição automática |
| `CrmService` | `createTag(ctx,label)`, `tagPerson(ctx,personId,tagId)` | Classificação |
| `CrmService` | `createNote(ctx,personId,body)`, `listNotes(ctx,id,limit)`, `listTimeline(ctx,id,limit)` | Notas e histórico |
| `PgCrmRepository` / `PgCrmRepositoryFactory` | Repositório TS em `src/postgres.ts` | Persistência tenant-scoped, detalhes internos não expostos como contrato por arquivo |
| `CrmWhatsAppIdentityPolicy` / `CrmWhatsAppIdentityConsumer` | `src/whatsapp-identity-events.ts` | Resolução/revisão de identidade; consumidor opt-in, não pipeline operacional garantido |

**Autorização:** operações passam por contexto e CoreKernel, e não devem confiar no tenant/org declarado pelo formulário. A guarda de entitlement separada tem rollout próprio.

## 3. Contratos públicos

- Root exporta `CrmService`, `CrmRepository`, tipos de `Person`, `Organization`, `Note`, `TimelineEntry` e políticas de identidade.
- Plugin exportado em `./plugin` fornece `CrmHttpModule`, permissões, migrações 001–003 e assets.
- Eventos CRM↔Inbox têm versões no catálogo de contratos, mas **a conexão automática ainda depende de gates**.

## 4. Frontend

- **Workspace:** `apps/workspace-web/src/features/crm.tsx` e `crm-person-detail.tsx` existem no código. Rotas e comportamento com Keycloak/OpenFGA real precisam de browser E2E.
- **Frontend embutido legado:** `modules/core-crm/public/` publicado pelo plugin, se instalado e autorizado.
- **Manager:** nenhuma tela CRM global deve ler dados do tenant diretamente; a camada Manager tem contexto próprio.

## 5. Schemas

| Banco | Ownership | Tabelas principais / migration |
|---|---|---|
| **Tenant DB** | CRM | `crm_people`, `crm_organizations`, `crm_person_organizations`, `crm_audit` — `sql/001_crm_foundation.sql` |
| **Tenant DB** | CRM | Tags/notas — `sql/002_crm_tags_notes.sql` |
| **Tenant DB** | CRM (transicional) | `crm_employees`, identidades de canal — `sql/003_crm_employees_channels.sql` |
| **Control/Manager DB** | Nenhuma tabela própria CRM | Entitlements e tenancy pertencem ao Control Plane; consulta via contrato confiável |

## 6. Evidência e dívida técnica

- Testes locais: **29 PASS**; integração real, manager↔tenant, E2E e Product Gate pendentes.
- Dívida prioritária: tirar conceito de trabalhador interno da semântica CRM sem quebrar `platform_staff_identity_links` nem migrations existentes.
- Fontes: [service.ts](https://github.com/delmacy/syndes-system/blob/main/modules/core-crm/src/service.ts), [index.ts](https://github.com/delmacy/syndes-system/blob/main/modules/core-crm/src/index.ts), [SQL](https://github.com/delmacy/syndes-system/tree/main/modules/core-crm/sql).


## Inventário detalhado e diagramas

A referência resumida acima é complementada por [INVENTARIO-INTEGRAL.md](INVENTARIO-INTEGRAL.md) e pelos diagramas versionados em [DIAGRAMAS.md](DIAGRAMAS.md). O inventário foi reconciliado em 13/11/2026 com 30 rotas, 9 tabelas e 53 declarações de colunas; não representa homologação de runtime.
