## 1. Missão, responsabilidades e fronteiras de persistência

### I04 — infraestrutura PostgreSQL

Manter a **fronteira física e lógica da persistência PostgreSQL** do Syndes, com roles de menor privilégio, dados separados por database, provisionamento confiável e gates de backup/restore. I04 não é um módulo NestJS, plugin, frontend, Event Bus ou schema de CRM.

| Responsabilidade | Owner efetivo | Fronteira |
|---|---|---|
| Servidor, Compose, volume, secrets PG e DB de sistema | **I04 + I02/Infra** | Inicialização do PostgreSQL e disponibilidade de conexão |
| Registry e memberships globais | **C01 — Control Plane** | `syndes_control` não armazena contatos, mensagens ou dados de tenant |
| Provisionamento de database/role por tenant | **C02 — Tenant Installer** com acesso operacional controlado | UUID canônico; cliente não escolhe DSN, DB ou role |
| Identity stores | **C03 Keycloak / C04 OpenFGA** | Databases `syndes_keycloak` e `syndes_openfga` isolados |
| Acesso administrativo global | **A05/Platform Manager** | Role `syndes_master_api` e objetos Control, sem CONNECT no banco tenant auditado |
| Dados de produto | **Owners CRM, Inbox, WhatsApp, Organizations, Support, Service** | SQL e histórico dentro do tenant DB/namespace do módulo |
| Event outbox e inbox por natureza | **C06/A04** (tenant events), **C01/C06** (Control events) | Schemas e contratos separados; disponibilidade do SQL não ativa worker |
| Backup, restore, staging e rollback | **I10/I11/Q08/Operação** | RPO/RTO e recuperação exigem ensaio real; teste CI não basta |

### Invariantes confirmados em fonte

- Um servidor PostgreSQL pode hospedar vários **databases separados**, não schema único compartilhado entre tenants.
- `00-init.sh` cria `syndes_control`, `syndes_keycloak`, `syndes_openfga` e respectivas roles; revoga `CONNECT` de `PUBLIC` nos três.
- `provision-tenant.sh` valida UUID, cria role/db individuais, registra estado **`provisioned`**; não ativa membership nem concede FGA.
- `syndes_core` recebe `SELECT` no registry/memberships; aplicações resolvem tenant por informação confiável server-side, nunca por nome de banco recebido do cliente.
- Migrations dos módulos têm gates de digest, checksum, canonicidade e owner. **Nenhum DDL em operação foi autorizado nesta auditoria.**

### Invariantes comprovados parcialmente no DevServer01

O banco do tenant encontrado tem `PUBLIC CONNECT=false`, `syndes_core CONNECT=false`, `syndes_master_api CONNECT=false`, é propriedade de sua role individual, que **não** é superuser/`CREATEDB`/`CREATEROLE`. Isso confirma **apenas o isolamento no catálogo de privilégios SQL para o DB observado**. Não comprova autorização de API, FGA, backup, instalação de módulos ou todos os tenants futuros.

**Fora de escopo:** dados pessoais, consultas de negócio, criação de tenants, `GRANT`, `ALTER ROLE`, migração de schemas, `pg_dump` ou limpeza do host.
