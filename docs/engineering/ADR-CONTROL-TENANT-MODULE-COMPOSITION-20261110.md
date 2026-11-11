# ADR — Composição de módulos do Control Plane e do Tenant Plane

**Data:** 2026-11-10. **Estado:** candidato parcialmente implementado; gates de runtime pendentes.

## Decisão: apps separadas, núcleo compartilhado, administração centralizada

| Camada | Projeto atual | Conexões permitidas |
| --- | --- | --- |
| Frontend Manager | apps/master-admin-web | master-admin-api, sob origem e cliente OIDC próprios |
| Control Plane API — inventário | apps/master-admin-api | syndes_control; role syndes_master_api somente leitura |
| Control Plane — concessão de conta | apps/account-access-api | Serviço separado e autenticado, sem grants implícitos de Manager |
| Control Plane — metadados técnicos | infra/postgres/bootstrap/control-*.schema | tenant registry, memberships, catálogo, entitlements, instalações, auditoria |
| Instalador por módulo/tenant | candidato apps/core-host/src/module-installer.ts | Processo técnico **separado** em futuro deploy, com roles de DDL e atestação distintas |
| Frontend do cliente | apps/workspace-web | Somente APIs de operação do tenant; origem, bundle e OIDC distintos |
| Tenant runtime / domínio | apps/core-host, modules/* | Bancos canônicos por tenant, schemas por módulo, OpenFGA |
| Compartilhamento de UI | packages/front-shared | Apenas componentes sem token, domínio, sessão ou contexto de tenant |
| Kernel | packages/core-kernel | Manifesto compilado, contratos e ports, sem credenciais de aplicações |

**Não criar** outro Control Plane frontend, Manager paralelo, gateway genérico para módulos ou management.controller duplicado em CRM, Inbox e WhatsApp. Control Plane é responsabilidade arquitetural já presente em serviços com credenciais deliberadamente diferentes.

### Fluxos previstos

1. **Inventário somente leitura:** operador autenticado no Manager consulta GET /v1/platform/admin/tenants/:tenantId/modules no syndes_control pela role syndes_master_api. A resposta mostra catálogo aprovado, entitlement efetivo considerando prazo, estado de instalação e versões. **Não traz** DSN, banco, role, recibo SHA ou conteúdo de clientes.
2. **Operação administrativa futura:** serviço de comandos próprio com validação de Keycloak iss/aud/azp/sub e autorização por ação, motivo, idempotência e trilha de auditoria. Não possui DDL do banco tenant no processo HTTP.
3. **Instalação futura:** job técnico autorizado realiza PLAN, APPLY e VERIFY em banco canônico de tenant; depois atesta Control DB. Ledger físico _syndes e proveniência de release são gates; não há transação distribuída entre bancos.
4. **Execução efetiva:** Workspace autentica ator, membership do tenant e escopo organização/workspace, OpenFGA e módulo entitled/installed/enabled comprovado no Host e workers. Status no frontend não concede permissão.

### Implementação nesta entrega

- Read model em apps/master-admin-api/src/modules/tenant-module-inventory.mjs, com gate existente de platform_operator_access no servidor HTTP e consulta SQL parametrizada, apenas ao Control DB.
- Detalhe de cliente já existente no Manager apresenta estados quando disponíveis. Não há novo item de navegação, botão de mutação ou grants falsos no visualpreview. Sem schema aplicado, mostra indisponibilidade; não transforma erro em catálogo vazio.
- SQL control-module-manager-readonly.schema é **candidato inativo**, depende das AK-10.02/03 e dá SELECT mínimo sobre metadados sem acesso à auditoria e sem comandos.
- INSTALLED/ENABLED são registros administrativos, **não prova de operação** até AK-10.04, que precisa ser conectado a rotas e jobs.
- A infraestrutura de Manager já opera com imagens, OIDC e rede dedicadas, distintas da Workspace. Não recriar frontends existentes.

### Limites de segurança

- Builds, imagens, origem HTTPS e client OIDC/audience diferentes para Manager e Workspace.
- Role SQL Manager não pode acessar bancos de tenant ou DDL, e rede privada não substitui ACL PostgreSQL.
- Owner da plataforma não vira dono de conversas, contatos, WhatsApp, arquivos ou credenciais dos tenants.
- Módulos de produto expõem manifests confiáveis, não endpoints gerenciais independentes; o Control Plane não consulta bancos operacionais.
- Erro no catálogo é indisponibilidade administrativa explícita e negação operacional. Inventário não substitui ModuleAccessPort.

### Gates antes de operação

1. Consolidação de #65/#66 e cadeia #69–#71 com CI no SHA integrado, sem misturar Organizations #68 ou Billing #67.
2. AK-10.04 obrigatória em endpoints e workers, pois controllers legados ainda usam CoreKernel.execute sem ModuleAccessPort e não são realmente bloqueados por entitlements.
3. AK-30.03–05: credenciais privilegiadas separadas, ACL por schema, upgrades, restore/rollback, release assinada e reconciliador.
4. AK-20: API de comandos autenticada/autorizada para funções de gerenciamento, Product Gate da UI e trilha de auditoria.
5. Migração Control DB aprovada com backup, grants mínimos, Keycloak/OpenFGA/OpenBao E2E, isolamento A/B e rollback de deploy.

Nenhuma migration de candidato foi incluída na inicialização operacional. Sem dados de catálogo e grants provisionados, o painel fica indisponível e não promete instalação.
