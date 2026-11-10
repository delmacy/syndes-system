# ADR — Core Kernel, Account & Access e schemas por módulo

**Estado:** proposta de arquitetura para implementação incremental (2026-11-10). **Repositório:** `delmacy/syndes-system`, baseline `afe057aa`. **Vínculo:** [WBS específica](WBS-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md), [WBS mestre](WBS-PROGRAMA-SYNDES-20261110.md), [Account Access](ACCOUNT-ACCESS-FOUNDATION.md), [Module Mounting](CORE-MODULE-MOUNTING.md).
**Autorização do proprietário:** planejar a conversão estrutural na fase de criação do sistema, sem clientes externos. **Não inferir que os bancos de desenvolvimento/homologação estejam vazios, que o tenant interno Syndes possa ser apagado, nem que multi-org esteja autorizado.**

## Problema e decisões

Objetivos: (i) **uma administração** de identidade, participação em contas/organizações/workspaces, roles/grants, validade, habilitação e auditoria; (ii) módulos confiáveis instaláveis/desativáveis por tenant, com dependências e migrations próprias; (iii) **um schema PostgreSQL por módulo** dentro de um database por tenant, com interface comum do Kernel/Host; (iv) views e projeções com consumidores e dependências declarados.

**Decisões:**
1. Reutilizar `packages/core-kernel` (biblioteca independente), `apps/core-host` (composition root), `apps/account-access-api` e `modules/organizations`. Não criar outra autoridade de identidade, outra base FGA nem outro serviço genérico monolítico.
2. Keycloak autentica por `iss+sub+aud+azp`/OIDC; Control Plane conserva tenant, memberships, ownership, contratos de serviço/planos e entitlements; OpenFGA decide relações/recurso/ação; OpenBao entrega credenciais técnicas por identidade de workload; Core Host executa o contexto validado; PostgreSQL aplica banco por tenant, schemas, ACLs e constraints. Dados privilegiados do Platform Manager continuam inacessíveis aos tenants. Não mapear cada humano a um login PostgreSQL.
3. O `CoreKernel.execute` já nega se TenancyPort ou AuthorizationPort negam. Acrescentar **porta de habilitação de módulo** e contexto operacional validado **sem** permitir acesso a DB, DNS/SQL, segredos ou conexão a partir do browser. Criar novo contrato versionado compatível ou migração coordenada dos consumidores; não introduzir quebra silenciosa.
4. Core Host monta apenas **packages confiáveis aprovados no build** (sem plugin arbitrário em runtime). Per-tenant `enabled` controla API, jobs, eventos, menus e migrations; não altera dinamicamente o código Nest carregado. Separar `available` (build), `entitled` (contrato), `installed` (schema/migrations), `enabled` (uso) e `suspended`/ `retired`.
5. Cada módulo novo possui **schema curto reservado** idêntico ao seu ID de banco (ex. `crm`, `inbox`, `whatsapp`, `support`, `organizations`, `scheduling`). `account` é schema **somente para dados operacionais do tenant**, se necessários; identidade e grants globais continuam no Control DB, não são duplicados. `read` e `reporting` são schemas derivados e **nunca** fonte canônica.
6. Dados de domínio são escritos apenas pelo módulo proprietário; integração por contratos/eventos/APIs autorizadas. Views do PostgreSQL são indicadas somente para leitura estável no mesmo tenant, com dependências versionadas; composição contextual, chamada externa, autorização e operações continuam no backend. Não depender de materialized view sem política de atualização e consistência.
7. **Sem DROP CASCADE no fluxo normal.** Desativação revoga acesso e interrompe workers/novas operações sem apagar dados; desinstalação lógica mantém dados para retenção/reativação. Remoção física é operação separada aprovada, após checagem de dependentes e restore comprovado.
8. Como não existem clientes comerciais, **a implementação poderá alterar estruturas em fixtures descartáveis diretamente**, sem sustentar compatibilidade eterna com tabelas `public.crm_*`. Porém, qualquer banco com dados ou serviços no DevServer01 exige inventário, backup e rollout explícito. A trava SQL 002 de single-context continua ativa até Product Gate independente #31; conversão de schema não habilita multi-org.

## Materialização encontrada no commit de referência

| Componente | Presente | Lacuna relevante |
| --- | --- | --- |
| `packages/core-kernel/src/kernel.ts` | `TenancyPort`, `AuthorizationPort`, checks fail-closed e ordem de módulos | Nenhum `ModuleEntitlementPort`/per-tenant runtime gate |
| `src/module-registry.ts` | id, versão, dependências e ciclos | Sem `schema`, contrato de migrações/versões e dependências de views |
| `src/plugin.ts` | Nest API, permissions, SQL file URLs, assets, OIDC client público | Sem proprietário do schema, instalação por tenant, read models, eventos ou uninstall lifecycle |
| `apps/core-host/src/module-host.ts` | Carregamento estático em `config/modules.json` e validação de dependências | Mesmo conjunto compilado para todos; config não é catálogo tenant |
| `apps/core-host/src/tenant-database.ts` | Registry confiável, OpenBao AppRole, pool por tenant, role `syndes_t_<uuid>` | Todos os módulos do tenant compartilham a role/pool; schemas não isolam roles automaticamente |
| `apps/core-host/src/adapters.ts` | JWT Keycloak, membership Control DB, OpenFGA | Modelo atual focado em `read/write`; não substituir por autorizações de frontend |
| `apps/account-access-api` + `control-account-roles.schema` / `control-account-delegation.schema` | Delegação owner/admin com aud/azp própria, idempotência, FGA e SQL controlado | Sem gestão administrativa completa de convites, colaboradores, módulos e reconciliação; **não implantada** |
| `modules/organizations` | Org/workspace, context/backfill e SQL 002 | Multi-org ainda com gate; não reinterpretar Owner como acesso operacional |
| `infra/postgres/bootstrap/migrate-modules-tenant.sh` | SQL de plugins instalados aplicado a banco tenant autorizado; suporte especial `support` | Não consulta entitlements por tenant nem ledger genérico checksum/rollback |
| `modules/*/sql` | Migrações SQL próprias por módulo | Tabelas majoritariamente no schema `public`, com prefixos; references/triggers cruzadas exigem conversão |

**Testes locais nesta revisão:** `packages/core-kernel npm test` 15/15 e `apps/account-access-api npm test` 10/10 no Win1; não comprovam PG real, PKCE real ou deploy.

## Fronteiras e modelagem-alvo

**Control DB** (schemas de controle não devem depender de módulos de negócio): `tenant_registry`, `tenant_memberships`, `tenant_account_role_grants`/audit, catálogo de módulos/versões, `tenant_module_entitlements`, `tenant_module_installs`, audit e estado de reconciliação. Identidade estável = issuer+sub, sem reutilizar e-mail como chave. Grants operacionais OpenFGA **não devem ser copiados como verdade alternativa**; a camada administrativa registra intenção, resultado, revisão e auditoria.

**Cada tenant DB:** schemas `organizations`, `crm`, `inbox`, `whatsapp` etc. A tabela de histórico de migrações por banco pode morar em schema **reservado** `_syndes` com owner/ACL protegidos e índice único `(module_id,migration_id)`, `checksum`, `applied_at`, `image_digest` e versionamento; Control DB conserva estado de instalação, não uma segunda cópia independente do histórico SQL. Padrões concretos de nomes ainda serão especificados na WBS de implementação.

**Identidade e grants:** Account owner/admin no Control DB não concede ler CRM/Inbox automaticamente. Um principal deve ter membership ativa no tenant e no contexto org/workspace, módulo ativo e permissão OpenFGA de recurso/ação. Mudanças de grants precisam de reconciliação idempotente com verificação das duas autoridades e audit trail; evitar dual-write síncrono fingindo transação PostgreSQL↔OpenFGA.

**Privilégios SQL:** fase inicial aceita a conexão técnica por tenant já existente, *desde que* Kernel/Host+escopo e testes negativos controlem cada operação. A segurança por módulo só será afirmada após separar roles/pools e conceder schemas/tabelas especificamente. Schema isolado sozinho **não** é sandbox nem garante menor privilégio. Para funções `SECURITY DEFINER`, qualificar objetos e fixar `search_path` seguro; proteger `CREATE` em schemas compartilhados.

## Padrão de manifest do módulo — proposta, não código

```ts
interface ModuleManifestV2 {
  id: string;                 // crm, inbox, whatsapp, etc.
  version: string;            // semver
  schema: string;             // um schema exclusivo de domínio
  dependencies: readonly string[];
  migrations: readonly {id: string; checksum: string; fileUrl: string}[];
  permissions: readonly {resource: string; actions: readonly string[]}[];
  readModels?: readonly {id: string; consumers: readonly string[]; dependencies: readonly string[]}[];
}
```

`schema` e SQL IDs devem vir de manifesto auditado, nunca de request. `permissions` descreve políticas a provisionar, **não gera grants automáticos**. A instalação terá planejamento antes de executar, conjunto de dependências, transações compatíveis e execução apenas em DB tenant canônico. Aplicar migrations apenas quando entitled+approved+installed target; habilitar API somente após schema/migration ledger verificados.

## Migração de schema — estratégia da fase de criação

- **Etapa 0 — simulação:** inventariar SQL/foreign keys/views/functions/triggers e fixture de cada módulo em PG17 descartável; classificar todos os dados de homologação/dev antes de qualquer reset.
- **Etapa 1 — fundamento:** manifest V2 compatível, catálogo por tenant, gate de enabled e migration ledger; logs de execução sem PII/segredos; testes negativos.
- **Etapa 2 — schemas e grants:** criar schema controlado por módulo; tabelas de novo bootstrap com nomes qualificados (`crm.people`, `inbox.conversations` etc.). Converter queries, SQL de triggers/functions, FKs cruzadas e testes em **um módulo por vez**.
- **Etapa 3 — contratos de integração:** nenhuma gravação cross-schema por SQL ad hoc; somente views de leitura aprovadas ou APIs/eventos do dono. Declarar read-model deps e testar caso módulo ausente.
- **Etapa 4 — instalação/desinstalação:** estado por tenant, dependências e suspensão segura (API/worker/queue); verificação de permissões em tarefas assíncronas; export/retention/restore antes de drop físico opcional.
- **Etapa 5 — homologação:** PostgreSQL descartável com tenants A/B, módulos diferentes, roles adversariais, Keycloak/OpenFGA reais, revogação/expiração e rollback; release só por SHA/digest.

### Regras que evitam decisões precipitadas

- Não alterar o repositório experimental `delmacy/syndes-packages` nem publicar pacote novo antes da consolidação; nomenclatura `@syndes/*` interna não equivale a scope de GitHub Packages autorizado.
- Não criar uma UI de Account & Access antes dos endpoints, matriz de autorização e casos negativos estarem definidos.
- Não confundir schema `organizations` (organização operacional do tenant) com `crm.organizations` (empresa de contato) nem com Control Plane.
- Não adicionar novas features comerciais ou expandir os PRDs do MVP; a mudança é infraestrutura de modularidade e segurança.
- Manter a WBS mestre como autoridade de prioridades, e a frente GitHub Actions separada conforme delegação já registrada.
