## 1. Missão, responsabilidades e limites do Control Plane

### C01 — Control Plane lógico e sua persistência

O C01 descreve **o plano administrativo da plataforma**: registry e memberships de tenants, catálogo e estado de módulos, versionamento/approval de releases e transições auditáveis. Seu source path `infra/postgres/bootstrap` contém contratos SQL, não um processo `control-plane` executável.

| Unidade | Proprietário da execução | Limite |
|---|---|---|
| **C01 — Control Plane** | Estrutura de `syndes_control` e consistência dos contratos globais | Não armazena dados de CRM, mensagens ou eventos do tenant |
| **I04 — PostgreSQL** | Serviço, volumes, databases, roles e segurança de conexão | Não é dono dos estados de produto/tenant |
| **C02 — Tenant Installer** | Provisionamento de DB/role e migrations tenant por release confiável | Não usar parâmetros arbitrários da requisição |
| **A08 — Core Kernel** | `ModuleCatalogPort`, `TenantModuleLifecyclePort`, `ModuleAccessPort`, contratos v1 | Não deve acessar PostgreSQL/Keycloak diretamente |
| **A04 — Core Host** | Adapters `PgModuleCatalog`, `PgModuleLifecycle`, `PgEffectiveModuleAccess` e composition root | `executeModule` opt-in, sem enforcement universal |
| **A05 — Manager API** | API administrativa GET, readmodel de tenants/módulos | Não tem conexão com tenant DB nem permissão de editar conteúdo |
| **A06 — Account Access API** | Delegação de papéis de conta, token/FGA e SQL restrito | Não deve virar API pública para conceder grants irrestritos |
| **C03/C04/C05 — Identity/FGA/Secrets** | Keycloak, OpenFGA, OpenBao | Identity/authorization/secrets independentes de registry e entitlements |
| **C06 — Event Platform** | Outbox, dispatchers e consumers de cada natureza de dados | `control_events` pertence ao banco Control; `platform_events` ao tenant DB |

### Invariantes fundamentais

- **Platform tenant ≠ organização CRM.** O registry global aponta um database canônico por tenant; pertencimentos e permissões de módulos são separadas das relações de CRM/workforce.
- **Tenant `active` ≠ módulo `enabled`.** São estados independentes; catálogo aprovado também não significa entitlement, instalação, verificação física ou autorização FGA.
- **Manager global ≠ usuário de banco tenant.** Leitura de metadados globais com role específica; sem impersonação, sem acesso às mensagens ou conversas.
- **Control DB ≠ outbox de negócio.** Eventos Control `platform.module.*.v1` devem usar schema `control_events`; conversas e mensagens do tenant usam `platform_events` em seu DB.
- **SQL offline ≠ runtime.** Migrations, funções de transição e triggers podem estar versionados sem terem sido aplicados; serviço Host/Master não os cria no boot.
- **Gate forte para mudanças:** fixar release SHA/checksum, validar backup/restore e autorização, verificar ledger, janela e rollback antes de DDL. Esta auditoria não executa nenhum desses passos mutantes.

### As-is versus desenho aprovado

O DevServer01 possui registry, membership e tabelas básicas de operadores/perfis. Um registro de tenant encontra-se em `active`, mas catálogo, lifecycle, roles de operadores de módulos, ledger e outbox Control **não existem** nesse banco. Portanto, **não inferir operação dos módulos a partir do tenant ativo**.

**C01 não possui frontend próprio**: os aplicativos Manager/Workspace/Support têm owners e fronteiras diferentes. Seu contrato é o modelo de dados e os serviços que consomem o Control.
