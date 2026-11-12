# Syndes Docs — índice de endereços diretos

Origem: catalog/work-units.json. Documentação inicial não equivale a funcionalidade homologada.

## Produto e integrações

| Unidade | Escopo | Status | Sprint | Fonte |
|---|---|---|---|---|
| P01 CRM | [ESCOPO](P01-crm/ESCOPO.md) | [STATUS](P01-crm/STATUS.md) | [SPRINT](P01-crm/SPRINT.md) | [modules/core-crm](../../modules/core-crm) |
| P02 Inbox | [ESCOPO](P02-inbox/ESCOPO.md) | [STATUS](P02-inbox/STATUS.md) | [SPRINT](P02-inbox/SPRINT.md) | [modules/inbox](../../modules/inbox) |
| P03 WhatsApp | [ESCOPO](P03-whatsapp/ESCOPO.md) | [STATUS](P03-whatsapp/STATUS.md) | [SPRINT](P03-whatsapp/SPRINT.md) | [modules/whatsapp](../../modules/whatsapp) |
| ↳ I09 Whatsmeow (componente do P03) | [Detalhes técnicos](I09-whatsmeow-runtime/REFERENCIA-TECNICA.md) | [Histórico](I09-whatsmeow-runtime/HISTORICO.md) | [WBS legada](I09-whatsmeow-runtime/EVOLUCAO.md) | [gateway Go](../../modules/whatsapp/gateway) |
| P04 Organizations & Workforce | [ESCOPO](P04-organizations-workforce/ESCOPO.md) | [STATUS](P04-organizations-workforce/STATUS.md) | [SPRINT](P04-organizations-workforce/SPRINT.md) | [modules/organizations](../../modules/organizations) |
| P05 Gestão de Atendimentos | [ESCOPO](P05-gestao-de-atendimentos/ESCOPO.md) | [STATUS](P05-gestao-de-atendimentos/STATUS.md) | [SPRINT](P05-gestao-de-atendimentos/SPRINT.md) | [modules/service-management](../../modules/service-management) |
| P07 Scheduling | [ESCOPO](P07-scheduling/ESCOPO.md) | [STATUS](P07-scheduling/STATUS.md) | [SPRINT](P07-scheduling/SPRINT.md) | [modules/scheduling](../../modules/scheduling) |
| P08 AI Assistant | [ESCOPO](P08-ai-assistant/ESCOPO.md) | [STATUS](P08-ai-assistant/STATUS.md) | [SPRINT](P08-ai-assistant/SPRINT.md) | [modules/ai-assistant](../../modules/ai-assistant) |
| P09 Documents | [ESCOPO](P09-documents/ESCOPO.md) | [STATUS](P09-documents/STATUS.md) | [SPRINT](P09-documents/SPRINT.md) | [modules/documents](../../modules/documents) |
| P10 Email | [ESCOPO](P10-email/ESCOPO.md) | [STATUS](P10-email/STATUS.md) | [SPRINT](P10-email/SPRINT.md) | [modules/email](../../modules/email) |
| G02 Produto e UX | [ESCOPO](G02-produto-e-ux/ESCOPO.md) | [STATUS](G02-produto-e-ux/STATUS.md) | [SPRINT](G02-produto-e-ux/SPRINT.md) | [docs/product](../../docs/product) |

## Plataforma e Core

| Unidade | Escopo | Status | Sprint | Fonte |
|---|---|---|---|---|
| P14 Platform Core | [ESCOPO](P14-platform-core/ESCOPO.md) | [STATUS](P14-platform-core/STATUS.md) | [SPRINT](P14-platform-core/SPRINT.md) | [modules/platform-core](../../modules/platform-core) |
| A04 Core Host | [ESCOPO](A04-core-host/ESCOPO.md) | [STATUS](A04-core-host/STATUS.md) | [SPRINT](A04-core-host/SPRINT.md) | [apps/core-host](../../apps/core-host) |
| A05 Manager API | [ESCOPO](A05-manager-api/ESCOPO.md) | [STATUS](A05-manager-api/STATUS.md) | [SPRINT](A05-manager-api/SPRINT.md) | [apps/master-admin-api](../../apps/master-admin-api) |
| A06 Account Access API | [ESCOPO](A06-account-access-api/ESCOPO.md) | [STATUS](A06-account-access-api/STATUS.md) | [SPRINT](A06-account-access-api/SPRINT.md) | [apps/account-access-api](../../apps/account-access-api) |
| A08 Core Kernel | [ESCOPO](A08-core-kernel/ESCOPO.md) | [STATUS](A08-core-kernel/STATUS.md) | [SPRINT](A08-core-kernel/SPRINT.md) | [packages/core-kernel](../../packages/core-kernel) |
| C01 Control Plane | [ESCOPO](C01-control-plane/ESCOPO.md) | [STATUS](C01-control-plane/STATUS.md) | [SPRINT](C01-control-plane/SPRINT.md) | [infra/postgres/bootstrap](../../infra/postgres/bootstrap) |
| C02 Tenant Installer | [ESCOPO](C02-tenant-installer/ESCOPO.md) | [STATUS](C02-tenant-installer/STATUS.md) | [SPRINT](C02-tenant-installer/SPRINT.md) | [apps/core-host/src/module-installer.ts](../../apps/core-host/src/module-installer.ts) |
| C03 Identity Keycloak | [ESCOPO](C03-identity-keycloak/ESCOPO.md) | [STATUS](C03-identity-keycloak/STATUS.md) | [SPRINT](C03-identity-keycloak/SPRINT.md) | [infra/security-access](../../infra/security-access) |
| C04 Authorization OpenFGA | [ESCOPO](C04-authorization-openfga/ESCOPO.md) | [STATUS](C04-authorization-openfga/STATUS.md) | [SPRINT](C04-authorization-openfga/SPRINT.md) | [infra/security-access/fga-model.json](../../infra/security-access/fga-model.json) |
| C05 Secrets OpenBao | [ESCOPO](C05-secrets-openbao/ESCOPO.md) | [STATUS](C05-secrets-openbao/STATUS.md) | [SPRINT](C05-secrets-openbao/SPRINT.md) | [infra/security-access/openbao](../../infra/security-access/openbao) |
| C06 Event Platform | [ESCOPO](C06-event-platform/ESCOPO.md) | [STATUS](C06-event-platform/STATUS.md) | [SPRINT](C06-event-platform/SPRINT.md) | [apps/core-host/src/platform-event-dispatcher.ts](../../apps/core-host/src/platform-event-dispatcher.ts) |
| C07 APIs e adapters | [ESCOPO](C07-apis-e-adapters/ESCOPO.md) | [STATUS](C07-apis-e-adapters/STATUS.md) | [SPRINT](C07-apis-e-adapters/SPRINT.md) | [apps/core-host/src/adapters.ts](../../apps/core-host/src/adapters.ts) |
| C08 Audit e observabilidade | [ESCOPO](C08-audit-e-observabilidade/ESCOPO.md) | [STATUS](C08-audit-e-observabilidade/STATUS.md) | [SPRINT](C08-audit-e-observabilidade/SPRINT.md) | [apps/core-host](../../apps/core-host) |
| G01 Arquitetura | [ESCOPO](G01-arquitetura/ESCOPO.md) | [STATUS](G01-arquitetura/STATUS.md) | [SPRINT](G01-arquitetura/SPRINT.md) | [docs/engineering](../../docs/engineering) |

## Frontends e experiência

| Unidade | Escopo | Status | Sprint | Fonte |
|---|---|---|---|---|
| A01 Workspace Frontend | [ESCOPO](A01-workspace-frontend/ESCOPO.md) | [STATUS](A01-workspace-frontend/STATUS.md) | [SPRINT](A01-workspace-frontend/SPRINT.md) | [apps/workspace-web](../../apps/workspace-web) |
| A02 Platform Manager Frontend | [ESCOPO](A02-platform-manager-frontend/ESCOPO.md) | [STATUS](A02-platform-manager-frontend/STATUS.md) | [SPRINT](A02-platform-manager-frontend/SPRINT.md) | [apps/master-admin-web](../../apps/master-admin-web) |
| A03 Support Frontend | [ESCOPO](A03-support-frontend/ESCOPO.md) | [STATUS](A03-support-frontend/STATUS.md) | [SPRINT](A03-support-frontend/SPRINT.md) | [apps/support-web](../../apps/support-web) |
| A07 Front Shared | [ESCOPO](A07-front-shared/ESCOPO.md) | [STATUS](A07-front-shared/STATUS.md) | [SPRINT](A07-front-shared/SPRINT.md) | [packages/front-shared](../../packages/front-shared) |

## Qualidade e infraestrutura

| Unidade | Escopo | Status | Sprint | Fonte |
|---|---|---|---|---|
| I01 DevServer01 | [ESCOPO](I01-devserver01/ESCOPO.md) | [STATUS](I01-devserver01/STATUS.md) | [SPRINT](I01-devserver01/SPRINT.md) | [docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md](../../docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md) |
| I02 server02 | [ESCOPO](I02-server02/ESCOPO.md) | [STATUS](I02-server02/STATUS.md) | [SPRINT](I02-server02/SPRINT.md) | [infra](../../infra) |
| I03 win1-server | [ESCOPO](I03-win1-server/ESCOPO.md) | [STATUS](I03-win1-server/STATUS.md) | [SPRINT](I03-win1-server/SPRINT.md) | [infra](../../infra) |
| I04 PostgreSQL | [ESCOPO](I04-postgresql/ESCOPO.md) | [STATUS](I04-postgresql/STATUS.md) | [SPRINT](I04-postgresql/SPRINT.md) | [infra/postgres](../../infra/postgres) |
| I05 Docker e redes | [ESCOPO](I05-docker-e-redes/ESCOPO.md) | [STATUS](I05-docker-e-redes/STATUS.md) | [SPRINT](I05-docker-e-redes/SPRINT.md) | [infra](../../infra) |
| I06 Traefik HTTPS | [ESCOPO](I06-traefik-https/ESCOPO.md) | [STATUS](I06-traefik-https/STATUS.md) | [SPRINT](I06-traefik-https/SPRINT.md) | [docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md](../../docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md) |
| I07 Tailnet | [ESCOPO](I07-tailnet/ESCOPO.md) | [STATUS](I07-tailnet/STATUS.md) | [SPRINT](I07-tailnet/SPRINT.md) | [infra/master-admin/check-tailnet-route.py](../../infra/master-admin/check-tailnet-route.py) |
| I08 Komodo | [ESCOPO](I08-komodo/ESCOPO.md) | [STATUS](I08-komodo/STATUS.md) | [SPRINT](I08-komodo/SPRINT.md) | [infra](../../infra) |
| I10 Backup e Restore | [ESCOPO](I10-backup-e-restore/ESCOPO.md) | [STATUS](I10-backup-e-restore/STATUS.md) | [SPRINT](I10-backup-e-restore/SPRINT.md) | [scripts/events/disposable_restore_drill.py](../../scripts/events/disposable_restore_drill.py) |
| I11 Release e Rollback | [ESCOPO](I11-release-e-rollback/ESCOPO.md) | [STATUS](I11-release-e-rollback/STATUS.md) | [SPRINT](I11-release-e-rollback/SPRINT.md) | [infra/master-admin/homolog-deploy.sh](../../infra/master-admin/homolog-deploy.sh) |
| I12 Segurança de host | [ESCOPO](I12-seguranca-de-host/ESCOPO.md) | [STATUS](I12-seguranca-de-host/STATUS.md) | [SPRINT](I12-seguranca-de-host/SPRINT.md) | [infra](../../infra) |
| Q01 Plataforma de testes | [ESCOPO](Q01-plataforma-de-testes/ESCOPO.md) | [STATUS](Q01-plataforma-de-testes/STATUS.md) | [SPRINT](Q01-plataforma-de-testes/SPRINT.md) | [tests](../../tests) |
| Q02 Testes unitários | [ESCOPO](Q02-testes-unitarios/ESCOPO.md) | [STATUS](Q02-testes-unitarios/STATUS.md) | [SPRINT](Q02-testes-unitarios/SPRINT.md) | [modules](../../modules) |
| Q03 Integração | [ESCOPO](Q03-integracao/ESCOPO.md) | [STATUS](Q03-integracao/STATUS.md) | [SPRINT](Q03-integracao/SPRINT.md) | [scripts/events](../../scripts/events) |
| Q04 Browser E2E | [ESCOPO](Q04-browser-e2e/ESCOPO.md) | [STATUS](Q04-browser-e2e/STATUS.md) | [SPRINT](Q04-browser-e2e/SPRINT.md) | [tests/platform](../../tests/platform) |
| Q05 Segurança | [ESCOPO](Q05-seguranca/ESCOPO.md) | [STATUS](Q05-seguranca/STATUS.md) | [SPRINT](Q05-seguranca/SPRINT.md) | [tests/security](../../tests/security) |
| Q06 Performance | [ESCOPO](Q06-performance/ESCOPO.md) | [STATUS](Q06-performance/STATUS.md) | [SPRINT](Q06-performance/SPRINT.md) | [tests/performance](../../tests/performance) |
| Q07 CI/CD | [ESCOPO](Q07-ci-cd/ESCOPO.md) | [STATUS](Q07-ci-cd/STATUS.md) | [SPRINT](Q07-ci-cd/SPRINT.md) | [scripts/ci/plan.mjs](../../scripts/ci/plan.mjs) |
| Q08 Release Engineering | [ESCOPO](Q08-release-engineering/ESCOPO.md) | [STATUS](Q08-release-engineering/STATUS.md) | [SPRINT](Q08-release-engineering/SPRINT.md) | [infra/master-admin](../../infra/master-admin) |
| Q09 Infra Tests | [ESCOPO](Q09-infra-tests/ESCOPO.md) | [STATUS](Q09-infra-tests/STATUS.md) | [SPRINT](Q09-infra-tests/SPRINT.md) | [tests/platform](../../tests/platform) |
| Q10 Quality Gates | [ESCOPO](Q10-quality-gates/ESCOPO.md) | [STATUS](Q10-quality-gates/STATUS.md) | [SPRINT](Q10-quality-gates/SPRINT.md) | [tests/integrity](../../tests/integrity) |
| G03 Engenharia e Git | [ESCOPO](G03-engenharia-e-git/ESCOPO.md) | [STATUS](G03-engenharia-e-git/STATUS.md) | [SPRINT](G03-engenharia-e-git/SPRINT.md) | [AGENTS.md](../../AGENTS.md) |
| G04 Privacidade | [ESCOPO](G04-privacidade/ESCOPO.md) | [STATUS](G04-privacidade/STATUS.md) | [SPRINT](G04-privacidade/SPRINT.md) | [tests/security](../../tests/security) |

## Operação e negócio

| Unidade | Escopo | Status | Sprint | Fonte |
|---|---|---|---|---|
| P06 Syndes Support | [ESCOPO](P06-syndes-support/ESCOPO.md) | [STATUS](P06-syndes-support/STATUS.md) | [SPRINT](P06-syndes-support/SPRINT.md) | [modules/support](../../modules/support) |
| P11 Onboarding | [ESCOPO](P11-onboarding/ESCOPO.md) | [STATUS](P11-onboarding/STATUS.md) | [SPRINT](P11-onboarding/SPRINT.md) | [modules/onboarding](../../modules/onboarding) |
| P12 Billing | [ESCOPO](P12-billing/ESCOPO.md) | [STATUS](P12-billing/STATUS.md) | [SPRINT](P12-billing/SPRINT.md) | [modules/billing](../../modules/billing) |
| P13 Commercial Site | [ESCOPO](P13-commercial-site/ESCOPO.md) | [STATUS](P13-commercial-site/STATUS.md) | [SPRINT](P13-commercial-site/SPRINT.md) | [modules/commercial-site](../../modules/commercial-site) |
| G05 Operação e suporte | [ESCOPO](G05-operacao-e-suporte/ESCOPO.md) | [STATUS](G05-operacao-e-suporte/STATUS.md) | [SPRINT](G05-operacao-e-suporte/SPRINT.md) | [docs/engineering/SYNDES-SUPPORT-RUNBOOK.md](../../docs/engineering/SYNDES-SUPPORT-RUNBOOK.md) |


## Modelo de seis páginas

Área → Módulo → Página. Cada módulo expõe Visão geral, Especificação, Referência técnica, Evolução, Histórico e Operação. O corpo da documentação organiza tópicos e diagramas; **não** cria subpastas visíveis na navegação. Arquivos canônicos anteriores (STATUS, SPRINT, prompts e updates) continuam acessíveis a agentes e usuários.
