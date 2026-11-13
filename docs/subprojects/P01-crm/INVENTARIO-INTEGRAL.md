# P01 CRM — Inventário integral de superfícies no código

> **Snapshot de código da main — 13/11/2026.** Este inventário não equivale a deploy, API pública homologada ou Product Gate. Paths e permissões são extraídos/mapeados para leitura; conferir os guards e o controller antes de implementar. Não inclui segredos nem registros de clientes.

## Visão de cobertura

- **30 rotas HTTP** com associação a ação documental.
- **9 tabelas** e **53 declarações de colunas** nas migrations 001–003.
- **84 ocorrências de assinaturas** detectadas em serviço, extras, persistência e integração de identidade. Há duplicações entre interface/implementação e métodos não públicos.
- **18 fichas de ação** (9 anteriores + 9 complementares), agrupadas em seis funções do CRM.
- **6 diagramas Mermaid** em [DIAGRAMAS.md](DIAGRAMAS.md), dos quais quatro também têm uma representação visual compacta na Biblioteca.

## Contratos HTTP e rastreabilidade

Prefixo base declarado: `/v1/tenants/:tenantId/crm`. O controller é o contrato HTTP declarado; o plugin fornece os recursos de autorização. Resposta 200/201/400/401/403/404/409/503 não pode ser generalizada sem verificar cada handler.

| Método | Caminho declarado | Recurso/ação de referência | Ficha |
|---|---|---|---|
| `GET` | `/v1/tenants/:tenantId/crm/capabilities` | `crm:context/read` | `crm-authorization` |
| `GET` | `/v1/tenants/:tenantId/crm/people` | `crm:people/read` | `crm-search-person` |
| `POST` | `/v1/tenants/:tenantId/crm/people` | `crm:people/write` | `crm-create-person` |
| `GET` | `/v1/tenants/:tenantId/crm/people/:id` | `crm:people/read` | `crm-search-person` |
| `PATCH` | `/v1/tenants/:tenantId/crm/people/:id` | `crm:people/write` | `crm-maintain-person` |
| `DELETE` | `/v1/tenants/:tenantId/crm/people/:id` | `crm:people/write` | `crm-maintain-person` |
| `GET` | `/v1/tenants/:tenantId/crm/organizations` | `crm:organizations/read` | `crm-manage-organizations` |
| `POST` | `/v1/tenants/:tenantId/crm/organizations` | `crm:organizations/write` | `crm-create-organization` |
| `GET` | `/v1/tenants/:tenantId/crm/organizations/:id` | `crm:organizations/read` | `crm-manage-organizations` |
| `PATCH` | `/v1/tenants/:tenantId/crm/organizations/:id` | `crm:organizations/write` | `crm-manage-organizations` |
| `DELETE` | `/v1/tenants/:tenantId/crm/organizations/:id` | `crm:organizations/write` | `crm-manage-organizations` |
| `POST` | `/v1/tenants/:tenantId/crm/people/:id/organizations` | `crm:relationships/write` | `crm-link-organization` |
| `GET` | `/v1/tenants/:tenantId/crm/tags` | `crm:tags/read` | `crm-tags` |
| `DELETE` | `/v1/tenants/:tenantId/crm/people/:id/organizations/:organizationId` | `crm:relationships/write` | `crm-manage-links` |
| `DELETE` | `/v1/tenants/:tenantId/crm/people/:id/tags/:tagId` | `crm:tags/write` | `crm-tags` |
| `POST` | `/v1/tenants/:tenantId/crm/tags` | `crm:tags/write` | `crm-tags` |
| `POST` | `/v1/tenants/:tenantId/crm/people/:id/tags` | `crm:tags/write` | `crm-tags` |
| `POST` | `/v1/tenants/:tenantId/crm/people/:id/notes` | `crm:notes/write` | `crm-create-note` |
| `GET` | `/v1/tenants/:tenantId/crm/people/:id/notes` | `crm:notes/read` | `crm-read-timeline` |
| `GET` | `/v1/tenants/:tenantId/crm/people/:id/organizations` | `crm:organizations/read` | `crm-manage-links` |
| `GET` | `/v1/tenants/:tenantId/crm/people/:id/tags` | `crm:tags/read` | `crm-tags` |
| `GET` | `/v1/tenants/:tenantId/crm/people/:id/channels` | `crm:channels/read` | `crm-channels` |
| `GET` | `/v1/tenants/:tenantId/crm/people/:id/employee` | `crm:employees/read` | `crm-employees` |
| `GET` | `/v1/tenants/:tenantId/crm/employees` | `crm:employees/read` | `crm-employees` |
| `GET` | `/v1/tenants/:tenantId/crm/people/:id/timeline` | `crm:people/read` | `crm-read-timeline` |
| `POST` | `/v1/tenants/:tenantId/crm/people/:id/employee` | `crm:employees/write` | `crm-employees` |
| `POST` | `/v1/tenants/:tenantId/crm/people/:id/channels` | `crm:channels/write` | `crm-channels` |
| `POST` | `/v1/tenants/:tenantId/crm/duplicates` | `crm:people/read` | `crm-duplicates` |
| `POST` | `/v1/tenants/:tenantId/crm/imports/csv` | `crm:people/write` | `crm-csv` |
| `GET` | `/v1/tenants/:tenantId/crm/exports/csv` | `crm:people/read` | `crm-csv` |

**Fonte:** `modules/core-crm/src/crm.controller.ts`. Regras adicionais de entrada `crm:context/read`, membership e módulo ENABLED dependem da configuração real do Core Host.

## Inventário do banco de dados

Origem: `modules/core-crm/sql/001_crm_foundation.sql`, `002_crm_tags_notes.sql` e `003_crm_employees_channels.sql`, aplicáveis a cada banco de tenant, não ao Control DB. O inventário de colunas abaixo é lexical; constraints SQL compostas, chaves estrangeiras e índices devem ser lidos no arquivo de origem.

### `crm_organizations`
**Migration:** `001_crm_foundation.sql` · **Fonte:** `modules/core-crm/sql/001_crm_foundation.sql`

| Coluna | Tipo declarado | Restrições inline (trecho) |
|---|---|---|
| `id` | `UUID` | NOT NULL |
| `tenant_id` | `UUID` | NOT NULL |
| `legal_name` | `TEXT` | NOT NULL CHECK (char_length(legal_name) BETWEEN 1 AND 160) |
| `trade_name` | `TEXT` | — |
| `tax_id` | `TEXT` | — |
| `archived_at` | `TIMESTAMPTZ` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT now() |

### `crm_people`
**Migration:** `001_crm_foundation.sql` · **Fonte:** `modules/core-crm/sql/001_crm_foundation.sql`

| Coluna | Tipo declarado | Restrições inline (trecho) |
|---|---|---|
| `id` | `UUID` | NOT NULL |
| `tenant_id` | `UUID` | NOT NULL |
| `name` | `TEXT` | NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160) |
| `email` | `TEXT` | — |
| `phone` | `TEXT` | — |
| `archived_at` | `TIMESTAMPTZ` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT now() |

### `crm_person_organizations`
**Migration:** `001_crm_foundation.sql` · **Fonte:** `modules/core-crm/sql/001_crm_foundation.sql`

| Coluna | Tipo declarado | Restrições inline (trecho) |
|---|---|---|
| `tenant_id` | `UUID` | NOT NULL |
| `person_id` | `UUID` | NOT NULL |
| `organization_id` | `UUID` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT now() |

### `crm_audit`
**Migration:** `001_crm_foundation.sql` · **Fonte:** `modules/core-crm/sql/001_crm_foundation.sql`

| Coluna | Tipo declarado | Restrições inline (trecho) |
|---|---|---|
| `id` | `BIGINT` | GENERATED ALWAYS AS IDENTITY PRIMARY KEY |
| `tenant_id` | `UUID` | NOT NULL |
| `actor_id` | `TEXT` | NOT NULL |
| `entity_type` | `TEXT` | NOT NULL |
| `entity_id` | `UUID` | NOT NULL |
| `action` | `TEXT` | NOT NULL |
| `recorded_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT now() |

### `crm_tags`
**Migration:** `002_crm_tags_notes.sql` · **Fonte:** `modules/core-crm/sql/002_crm_tags_notes.sql`

| Coluna | Tipo declarado | Restrições inline (trecho) |
|---|---|---|
| `tenant_id` | `UUID` | NOT NULL |
| `id` | `UUID` | NOT NULL |
| `label` | `TEXT` | NOT NULL CHECK(char_length(label) BETWEEN 1 AND 64) |
| `label_key` | `TEXT` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT now() |

### `crm_person_tags`
**Migration:** `002_crm_tags_notes.sql` · **Fonte:** `modules/core-crm/sql/002_crm_tags_notes.sql`

| Coluna | Tipo declarado | Restrições inline (trecho) |
|---|---|---|
| `tenant_id` | `UUID` | NOT NULL |
| `person_id` | `UUID` | NOT NULL |
| `tag_id` | `UUID` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT now() |

### `crm_notes`
**Migration:** `002_crm_tags_notes.sql` · **Fonte:** `modules/core-crm/sql/002_crm_tags_notes.sql`

| Coluna | Tipo declarado | Restrições inline (trecho) |
|---|---|---|
| `tenant_id` | `UUID` | NOT NULL |
| `id` | `UUID` | NOT NULL |
| `person_id` | `UUID` | NOT NULL |
| `body` | `TEXT` | NOT NULL CHECK(char_length(body) BETWEEN 1 AND 5000) |
| `created_by` | `TEXT` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT now() |

### `crm_employees`
**Migration:** `003_crm_employees_channels.sql` · **Fonte:** `modules/core-crm/sql/003_crm_employees_channels.sql`

| Coluna | Tipo declarado | Restrições inline (trecho) |
|---|---|---|
| `tenant_id` | `UUID` | NOT NULL |
| `id` | `UUID` | NOT NULL |
| `person_id` | `UUID` | NOT NULL |
| `job_title` | `TEXT` | NOT NULL CHECK(char_length(job_title) BETWEEN 1 AND 160) |
| `active` | `BOOLEAN` | NOT NULL DEFAULT true |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT now() |

### `crm_channel_identities`
**Migration:** `003_crm_employees_channels.sql` · **Fonte:** `modules/core-crm/sql/003_crm_employees_channels.sql`

| Coluna | Tipo declarado | Restrições inline (trecho) |
|---|---|---|
| `tenant_id` | `UUID` | NOT NULL |
| `id` | `UUID` | NOT NULL |
| `person_id` | `UUID` | NOT NULL |
| `channel` | `TEXT` | NOT NULL CHECK(channel IN ('whatsapp','instagram','email')) |
| `external_id` | `TEXT` | NOT NULL CHECK(char_length(external_id) BETWEEN 1 AND 256) |
| `display_name` | `TEXT` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT now() |

## Assinaturas de classes, interfaces e serviços

> Este conjunto não é um catálogo de funções públicas. Entradas duplicadas são esperadas porque interfaces, classes e adapters declaram métodos com nomes semelhantes. O agente precisa conferir o escopo real antes de chamar um símbolo.

| Assinatura detectada | Origem e linha aproximada |
|---|---|
| `async()=&gt;handler(await this.repositoryForTenant(context.tenantId,context.organizationId)));` | `modules/core-crm/src/service.ts:35` |
| `createOrganization(context:CrmContext,input:CreateOrganization):Promise&lt;Organization&gt;{` | `modules/core-crm/src/service.ts:37` |
| `createPerson(context:CrmContext,input:CreatePerson):Promise&lt;Person&gt;{` | `modules/core-crm/src/service.ts:47` |
| `linkPerson(context:CrmContext,personId:string,organizationId:string):Promise&lt;PersonOrganization&gt;{` | `modules/core-crm/src/service.ts:57` |
| `getPerson(context:CrmContext,personId:string):Promise&lt;Person\|null&gt;{` | `modules/core-crm/src/service.ts:63` |
| `listPeople(context:CrmContext,query:unknown=null,limit=25,offset=0):Promise&lt;readonly Person[]&gt;{` | `modules/core-crm/src/service.ts:69` |
| `archivePerson(context:CrmContext,personId:string):Promise&lt;boolean&gt;{` | `modules/core-crm/src/service.ts:77` |
| `createTag(context:CrmContext,label:unknown):Promise&lt;Tag&gt;{` | `modules/core-crm/src/service.ts:83` |
| `tagPerson(context:CrmContext,personId:string,tagId:string):Promise&lt;PersonTag&gt;{` | `modules/core-crm/src/service.ts:90` |
| `createNote(context:CrmContext,personId:string,body:unknown):Promise&lt;Note&gt;{` | `modules/core-crm/src/service.ts:96` |
| `listNotes(context:CrmContext,personId:string,limit=50):Promise&lt;readonly Note[]&gt;{` | `modules/core-crm/src/service.ts:107` |
| `listTimeline(context:CrmContext,personId:string,limit=50):Promise&lt;readonly TimelineEntry[]&gt;{` | `modules/core-crm/src/service.ts:114` |
| `updatePerson(tenant:string,actor:string,personId:string,fields:CreatePerson):Promise&lt;Person\|null&gt;;` | `modules/core-crm/src/extra.ts:18` |
| `getOrganization(tenant:string,orgId:string):Promise&lt;Organization\|null&gt;;` | `modules/core-crm/src/extra.ts:19` |
| `listOrganizations(tenant:string,query:string\|null,limit:number,offset?:number):Promise&lt;readonly Organization[]&gt;;` | `modules/core-crm/src/extra.ts:20` |
| `updateOrganization(tenant:string,actor:string,orgId:string,fields:{legalName:string;tradeName:string\|null;taxId:string\|null}):Promise&lt;Organization\|null&gt;;` | `modules/core-crm/src/extra.ts:21` |
| `archiveOrganization(tenant:string,actor:string,orgId:string):Promise&lt;boolean&gt;;` | `modules/core-crm/src/extra.ts:22` |
| `createEmployee(tenant:string,actor:string,employeeId:string,personId:string,jobTitle:string):Promise&lt;Employee&gt;;` | `modules/core-crm/src/extra.ts:23` |
| `linkChannel(tenant:string,actor:string,id:string,personId:string,channel:string,externalId:string,displayName:string\|null):Promise&lt;ChannelIdentity&gt;;` | `modules/core-crm/src/extra.ts:24` |
| `duplicates(tenant:string,email:string\|null,phone:string\|null,excludeId:string\|null):Promise&lt;readonly DuplicateCandidate[]&gt;;` | `modules/core-crm/src/extra.ts:25` |
| `importPeople(tenant:string,actor:string,people:readonly (CreatePerson&{id:string})[]):Promise&lt;number&gt;;` | `modules/core-crm/src/extra.ts:26` |
| `listExportPeople(tenant:string,limit:number):Promise&lt;readonly Person[]&gt;;` | `modules/core-crm/src/extra.ts:27` |
| `listEmployees(tenant:string,limit:number):Promise&lt;readonly Employee[]&gt;;` | `modules/core-crm/src/extra.ts:28` |
| `getPersonEmployee(tenant:string,personId:string):Promise&lt;Employee\|null&gt;;` | `modules/core-crm/src/extra.ts:29` |
| `listChannels(tenant:string,personId:string,limit:number):Promise&lt;readonly ChannelIdentity[]&gt;;` | `modules/core-crm/src/extra.ts:30` |
| `listPersonOrganizations(tenant:string,personId:string,limit:number):Promise&lt;readonly Organization[]&gt;;` | `modules/core-crm/src/extra.ts:31` |
| `listPersonTags(tenant:string,personId:string,limit:number):Promise&lt;readonly {id:string;label:string}[]&gt;;` | `modules/core-crm/src/extra.ts:32` |
| `listTags(tenant:string,limit:number):Promise&lt;readonly {id:string;label:string}[]&gt;;` | `modules/core-crm/src/extra.ts:33` |
| `unlinkOrganization(tenant:string,actor:string,personId:string,orgId:string):Promise&lt;boolean&gt;;` | `modules/core-crm/src/extra.ts:34` |
| `unlinkTag(tenant:string,actor:string,personId:string,tagId:string):Promise&lt;boolean&gt;;` | `modules/core-crm/src/extra.ts:35` |
| `async()=&gt;work(await this.resolve(ctx.tenantId,ctx.organizationId)));` | `modules/core-crm/src/extra.ts:45` |
| `updatePerson(ctx:CrmContext,personId:string,input:CreatePerson):Promise&lt;Person\|null&gt;{` | `modules/core-crm/src/extra.ts:47` |
| `getOrganization(ctx:CrmContext,orgId:string):Promise&lt;Organization\|null&gt;{` | `modules/core-crm/src/extra.ts:52` |
| `listOrganizations(ctx:CrmContext,query:unknown=null,limit=25,offset=0):Promise&lt;readonly Organization[]&gt;{` | `modules/core-crm/src/extra.ts:56` |
| `updateOrganization(ctx:CrmContext,orgId:string,input:{legalName:string;tradeName?:string\|null;taxId?:string\|null}):Promise&lt;Organization\|null&gt;{` | `modules/core-crm/src/extra.ts:62` |
| `archiveOrganization(ctx:CrmContext,orgId:string):Promise&lt;boolean&gt;{` | `modules/core-crm/src/extra.ts:68` |
| `createEmployee(ctx:CrmContext,personId:string,jobTitle:unknown):Promise&lt;Employee&gt;{` | `modules/core-crm/src/extra.ts:72` |
| `linkChannel(ctx:CrmContext,personId:string,input:{channel:string;externalId:string;displayName?:string\|null}):Promise&lt;ChannelIdentity&gt;{` | `modules/core-crm/src/extra.ts:77` |
| `possibleDuplicates(ctx:CrmContext,input:{email?:string\|null;phone?:string\|null;excludeId?:string\|null}):Promise&lt;readonly DuplicateCandidate[]&gt;{` | `modules/core-crm/src/extra.ts:87` |
| `importCsv(ctx:CrmContext,csv:unknown):Promise&lt;ImportResult&gt;{` | `modules/core-crm/src/extra.ts:93` |
| `getPersonEmployee(ctx:CrmContext,personId:string):Promise&lt;Employee\|null&gt;{` | `modules/core-crm/src/extra.ts:97` |
| `listEmployees(ctx:CrmContext,limit=100):Promise&lt;readonly Employee[]&gt;{` | `modules/core-crm/src/extra.ts:102` |
| `listPersonOrganizations(ctx:CrmContext,personId:string):Promise&lt;readonly Organization[]&gt;{` | `modules/core-crm/src/extra.ts:106` |
| `listTags(ctx:CrmContext):Promise&lt;readonly {id:string;label:string}[]&gt;{` | `modules/core-crm/src/extra.ts:111` |
| `unlinkOrganization(ctx:CrmContext,personId:string,orgId:string):Promise&lt;boolean&gt;{` | `modules/core-crm/src/extra.ts:114` |
| `unlinkTag(ctx:CrmContext,personId:string,tagId:string):Promise&lt;boolean&gt;{` | `modules/core-crm/src/extra.ts:119` |
| `listPersonTags(ctx:CrmContext,personId:string):Promise&lt;readonly {id:string;label:string}[]&gt;{` | `modules/core-crm/src/extra.ts:124` |
| `listChannels(ctx:CrmContext,personId:string):Promise&lt;readonly ChannelIdentity[]&gt;{` | `modules/core-crm/src/extra.ts:129` |
| `exportCsv(ctx:CrmContext):Promise&lt;string&gt;{` | `modules/core-crm/src/extra.ts:133` |
| `updatePerson(t:string,a:string,p:string,v:CreatePerson):Promise&lt;Person\|null&gt;{` | `modules/core-crm/src/extra.ts:155` |
| `getOrganization(t:string,id:string):Promise&lt;Organization\|null&gt;{` | `modules/core-crm/src/extra.ts:166` |
| `listOrganizations(t:string,q:string\|null,limit:number,offset=0):Promise&lt;readonly Organization[]&gt;{` | `modules/core-crm/src/extra.ts:171` |
| `updateOrganization(t:string,a:string,id:string,v:{legalName:string;tradeName:string\|null;taxId:string\|null}):Promise&lt;Organization\|null&gt;{` | `modules/core-crm/src/extra.ts:182` |
| `archiveOrganization(t:string,a:string,id:string):Promise&lt;boolean&gt;{` | `modules/core-crm/src/extra.ts:193` |
| `createEmployee(t:string,a:string,id:string,p:string,job:string):Promise&lt;Employee&gt;{` | `modules/core-crm/src/extra.ts:204` |
| `linkChannel(t:string,a:string,id:string,p:string,channel:string,external:string,display:string\|null):Promise&lt;ChannelIdentity&gt;{` | `modules/core-crm/src/extra.ts:217` |
| `duplicates(t:string,em:string\|null,ph:string\|null,excluded:string\|null):Promise&lt;readonly DuplicateCandidate[]&gt;{` | `modules/core-crm/src/extra.ts:231` |
| `importPeople(t:string,a:string,people:readonly (CreatePerson&{id:string})[]):Promise&lt;number&gt;{` | `modules/core-crm/src/extra.ts:243` |
| `getPersonEmployee(t:string,personId:string):Promise&lt;Employee\|null&gt;{` | `modules/core-crm/src/extra.ts:261` |
| `listEmployees(t:string,limit:number):Promise&lt;readonly Employee[]&gt;{` | `modules/core-crm/src/extra.ts:269` |
| `listChannels(t:string,personId:string,limit:number):Promise&lt;readonly ChannelIdentity[]&gt;{` | `modules/core-crm/src/extra.ts:276` |
| `listPersonOrganizations(t:string,personId:string,limit:number):Promise&lt;readonly Organization[]&gt;{` | `modules/core-crm/src/extra.ts:286` |
| `listPersonTags(t:string,personId:string,limit:number):Promise&lt;readonly {id:string;label:string}[]&gt;{` | `modules/core-crm/src/extra.ts:300` |
| `listTags(t:string,limit:number):Promise&lt;readonly {id:string;label:string}[]&gt;{` | `modules/core-crm/src/extra.ts:312` |
| `unlinkOrganization(t:string,a:string,personId:string,orgId:string):Promise&lt;boolean&gt;{` | `modules/core-crm/src/extra.ts:318` |
| `unlinkTag(t:string,a:string,personId:string,tagId:string):Promise&lt;boolean&gt;{` | `modules/core-crm/src/extra.ts:332` |
| `listExportPeople(t:string,limit:number):Promise&lt;readonly Person[]&gt;{` | `modules/core-crm/src/extra.ts:346` |
| `forTenant(t:string,organizationId?:string):Promise&lt;ExtraRepository&gt;{` | `modules/core-crm/src/extra.ts:356` |
| `createOrganization(tenantId:string,actorId:string,id:string,input:CreateOrganization):Promise&lt;Organization&gt;{` | `modules/core-crm/src/postgres.ts:42` |
| `createPerson(tenantId:string,actorId:string,id:string,input:CreatePerson):Promise&lt;Person&gt;{` | `modules/core-crm/src/postgres.ts:60` |
| `linkPerson(tenantId:string,actorId:string,personId:string,organizationId:string):Promise&lt;PersonOrganization&gt;{` | `modules/core-crm/src/postgres.ts:78` |
| `getPerson(tenantId:string,id:string):Promise&lt;Person\|null&gt;{` | `modules/core-crm/src/postgres.ts:107` |
| `listPeople(tenantId:string,query:string\|null,limit:number,offset=0):Promise&lt;readonly Person[]&gt;{` | `modules/core-crm/src/postgres.ts:115` |
| `archivePerson(tenantId:string,actorId:string,id:string):Promise&lt;boolean&gt;{` | `modules/core-crm/src/postgres.ts:145` |
| `createTag(tenantId:string,actorId:string,id:string,label:string):Promise&lt;Tag&gt;{` | `modules/core-crm/src/postgres.ts:161` |
| `tagPerson(tenantId:string,actorId:string,personId:string,tagId:string):Promise&lt;PersonTag&gt;{` | `modules/core-crm/src/postgres.ts:179` |
| `createNote(tenantId:string,actorId:string,id:string,personId:string,body:string):Promise&lt;Note&gt;{` | `modules/core-crm/src/postgres.ts:201` |
| `listNotes(tenantId:string,personId:string,limit:number):Promise&lt;readonly Note[]&gt;{` | `modules/core-crm/src/postgres.ts:226` |
| `listTimeline(tenantId:string,personId:string,limit:number):Promise&lt;readonly TimelineEntry[]&gt;{` | `modules/core-crm/src/postgres.ts:239` |
| `forTenant(tenantId:string,organizationId?:string):Promise&lt;CrmRepository&gt;{` | `modules/core-crm/src/postgres.ts:259` |
| `loadIdentity(tx:TenantTransaction,scope:CrmIdentityScope):Promise&lt;CrmWhatsAppIdentityContext&gt;;` | `modules/core-crm/src/whatsapp-identity-events.ts:11` |
| `decide(tx:TenantTransaction,scope:CrmIdentityScope):Promise&lt;CrmIdentityDecision&gt;{` | `modules/core-crm/src/whatsapp-identity-events.ts:21` |
| `validateLink(tx:TenantTransaction,scope:CrmIdentityScope & Readonly&lt;{` | `modules/core-crm/src/whatsapp-identity-events.ts:62` |
| `handle(tx:TenantTransaction,event:StoredPlatformEvent):Promise&lt;void&gt;{` | `modules/core-crm/src/whatsapp-identity-events.ts:74` |

## Contratos, eventos e fronteiras

- **Contratos TypeScript:** `modules/core-crm/src/contracts.ts` para `Person`, `Organization`, `CrmContext`, `CrmRepository` e estruturas correlatas.
- **Plugin público:** `modules/core-crm/src/plugin.ts`, com recursos CRM e migrations 001–003.
- **Eventos observados:** `inbox.participant.observed.v1`; emitidos pelo CRM: `crm.person.resolved.v1` ou `crm.person.review_required.v1`. Fonte: `src/whatsapp-identity-events.ts`.
- **Fronteira de escopo:** `CrmDefaultContextGuard`, `CoreKernel`, OpenFGA e provider confiável de banco tenant. Não equivale a liberação de multi-org.
- **Interfaces:** `apps/workspace-web/src/features/crm.tsx` e `crm-person-detail.tsx`; interface embutida herdada em `modules/core-crm/public/`.

## Matriz de evidências e pendências

| Esfera | Evidência presente | Limite verificável | Próxima prova |
|---|---|---|---|
| Serviço / API | Controller, service, extras e contratos | Código não comprova rota operacional | Host autenticado com JWT/FGA real |
| Dados | Migrations 001–003 e consultas tenant/org | Não se verificou aplicação em produção | Inventário de versões aplicadas, restore e rollback |
| Segurança | Context Guard, Kernel, recursos e testes de escopo | SQL 002 e gates impedem afirmação de multi-org | Negativas 401/403, tenants A/B e contexto workspace |
| Frontend | CRM Workspace e detalhe de pessoa | UI com mocks não fecha Product Gate | Browser E2E com dados/autorização reais |
| Eventos | Policy + consumer opt-in, outbox declarada | Cutover e revisão humana não homologados | Replay/idempotência, consumidores e tratamento de ambiguidades |
| Operação | STATUS, OPERACAO, WBS e histórico | Runbook operacional específico não comprovado | Observabilidade, grants, backup/restore, releases por SHA |

## Fontes de autoridade e próximos passos

- [STATUS.md](STATUS.md) — estado de aceite e bloqueios.
- [REFERENCIA-TECNICA.md](REFERENCIA-TECNICA.md) — inventário resumido anterior; este documento o complementa.
- [DIAGRAMAS.md](DIAGRAMAS.md) — diagramas versionados.
- [OPERACAO.md](OPERACAO.md) — roteiro de verificação, não autorização operacional.
- [ESCOPO.md](ESCOPO.md) e [EVOLUCAO.md](EVOLUCAO.md) — planejamento separado de implementação.

**Regra de atualização:** ao alterar controller, método de domínio, tabela ou evento, reconcilie o inventário, o vínculo com a ação, os diagramas e os testes de integridade antes de publicar. Não marcar DONE automaticamente.
