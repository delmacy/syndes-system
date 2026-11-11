# AGENTS.md — Syndes Global

## Missão

Entregar o MVP da Syndes até produção e primeiro cliente externo pagante, sem reabrir continuamente o escopo.

## Regra principal

Antes de implementar qualquer ideia nova, classifique-a:

- `BLOCKER`: impede entrega, operação, segurança ou compliance.
- `BUG`: comportamento do escopo aprovado que está incorreto.
- `MVP`: explicitamente previsto no baseline.
- `POST-MVP`: todo o resto.

Itens `POST-MVP` podem ser registrados em uma linha, mas **não recebem pesquisa, arquitetura, spike, WP ou implementação antes do lançamento**.

## Ordem de execução

Trabalhar funcionalmente em apenas um módulo de produto por vez:

1. Core CRM
2. Inbox
3. WhatsApp
4. **Gestão de Atendimentos Básica (PRD-003A)**
5. Scheduling
6. AI First-Level Assistant
7. Documents
8. Email
9. Onboarding
10. Subscription & Billing
11. Commercial Website
12. Release Candidate

**Atualização 2026-11-11:** Funil Básico PRD-003A passou ao MVP e deve acompanhar CRM/Inbox/WhatsApp antes de Scheduling; o construtor avançado F0–F8 permanece congelado. A WBS 55 registra gates e a entrega de domínio não significa API/UI/produção.

**Priorização mais recente (2026-11-01):** após a evolução da Inbox, o responsável pelo produto **autorizou concluir as tarefas pendentes do frontend Core CRM**, mantendo o escopo do MVP congelado. O foco imediato é validar e finalizar `feat/crm-workspace-completion` e seus critérios, não abrir novos módulos. CRM e Inbox **não são DONE** até Product Gate formal com testes de identidade/tenant reais e operação comprovada. A sequência comercial do MVP permanece inalterada.

## Fronteiras de frontend e backend (decisão de 2026-11-10)

- Leia docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md e docs/engineering/WBS-FRONTEND-BACKEND-COMPOSITION-20261110.md antes de refatorar Workspace, Manager, plugins NestJS ou contexto de organização.
- Duas aplicações frontend por ambiente de confiança: apps/master-admin-web para Platform Manager e apps/workspace-web para os tenants; **não** criar frontend por módulo backend nem frontend separado para Account/Organization/Workspace.
- Features React permanecem no frontend correspondente; modules/* são packages de backend NestJS, com plugin/manifests confiáveis. O CRM ainda possui assets legados em seu plugin: preservar consumidores até inventário e gate de migração.
- packages/front-shared compartilha componentes visuais puros entre Manager e Workspace, **nunca** tokens, tenants, sessão, APIs ou autorização.
- Account/Organization/Workspace são contextos, não módulos. Distinguir Platform Organization (empresa do tenant) de CRM Organization (empresa cadastrada como contato).
- Antes de ativar navegação por módulos, exigir contrato tenant-safe de módulos realmente ENABLED e gate server-side em todos os controllers/jobs. Sem plugins frontend remotos, microfrontends, menus falsos, entitlement só visual ou nova engine genérica no MVP.
- A interface de Account só cresce apoiada em serviço autorizado; Account Owner não recebe acesso CRM/Inbox sem grants de Organization/Workspace. Multi-org permanece bloqueado pelos gates #21/#31 e SQL 002.

## Princípios de engenharia

- Preferir monólito modular enquanto não houver evidência concreta para separação.
- Não criar abstrações para problemas hipotéticos.
- Infraestrutura acompanha a necessidade do produto, não o contrário.
- `IMPLEMENTED != INTEGRATED != TESTED != PROVEN != DONE`.
- Um módulo só está DONE se estiver integrado, seguro, testado, observável, utilizável e demonstrável.
- Não duplicar source of truth.
- Não introduzir provider externo diretamente no domínio; usar contratos/adapters quando houver risco de substituição real já conhecido.
- Não criar framework genérico de plugins, workflow engine ou marketplace no MVP.

## Segurança global

Segurança é requisito funcional transversal.

Obrigatório:

- tenant isolation;
- server-side authorization;
- least privilege;
- validação de input;
- segregação de secrets;
- TLS;
- logs sem passwords/tokens/credenciais financeiras;
- auditoria de operações críticas;
- backups e restore testado;
- webhooks autenticados e idempotentes;
- uploads validados;
- ações de IA mediadas por tools autorizadas;
- nenhuma seleção de database/tenant controlada pelo cliente.

Uma única exposição cross-tenant é falha crítica.

## Dados

- Control Plane possui banco próprio.
- Cada tenant possui PostgreSQL database próprio.
- IDs permanentes não dependem de nome comercial.
- Platform admin não implica acesso automático ao conteúdo dos tenants.
- CRM é fonte canônica de pessoas/organizações; canais mantêm identidades externas vinculadas.

## Billing

Cada pagamento confirmado concede 30 dias de uso a partir da confirmação.

- D+0 a D+10: operação completa.
- D+11: AI N1 suspensa.
- D+31: gateway WhatsApp suspenso.
- Inadimplência não apaga dados nem destrói a sessão/configuração WhatsApp.
- Regularização reativa automaticamente e define novo `paid_until = payment_confirmed_at + 30 dias`.

## Git e CI

- Não considerar um commit saudável sem CI verde.
- Toda alteração deve preservar testes existentes.
- Não enfraquecer testes para fazer CI passar.
- Migrations devem ser testáveis em banco descartável.
- Dependências devem ser instaladas com lockfile congelado quando a stack for criada.
- Stress tests pesados não rodam em cada commit; integridade rápida roda em commits/PRs.
- Release Candidate exige stress, spike, soak, backup/restore e isolamento aprovados.

## Performance

Perfis de stress planejados:

- 50 tenants
- 200 tenants
- 500 tenants
- 1000 tenants
- 2500 tenants

O objetivo é descobrir gargalo, ruptura e recuperação sob RAM/CPU controladas.

Invariantes que não podem degradar:

- cross-tenant leak = 0
- unauthorized access = 0
- corrupted records = 0
- mensagens não podem desaparecer silenciosamente

## Antes de editar um módulo

Leia o `AGENTS.md` mais próximo do arquivo. Regras locais complementam este documento e não podem reduzir segurança ou ampliar escopo.

## Definition of Done global

Uma entrega só é DONE quando:

- requisitos aceitos;
- regras de negócio implementadas;
- persistência correta;
- frontend/backend integrados quando aplicável;
- autorização aplicada;
- isolamento testado;
- erros tratados;
- logs e métricas suficientes;
- testes automatizados relevantes verdes;
- segurança revisada;
- jornada de aceite demonstrável.

## Event infrastructure (2026-11-11)

- Leia docs/engineering/ADR-PLATFORM-EVENTS-20261111.md e WBS-PLATFORM-EVENTS-20261111.md antes de introduzir novos eventos.
- Dados de negócio permanecem nos módulos; eventos de cada tenant ficam apenas no schema platform_events dentro de seu database. Nunca usar syndes_control para dados de eventos tenant.
- Publisher requer TenantPgProvider.withTransaction e lease fixado; query-only TenantDatabase não oferece atomicidade.
- At least once, idempotência por consumer e efeito + inbox num COMMIT; sem JWTs artificiais de usuário, sem enforcement ENABLED ou DDL operacional antes dos gates.
- O contrato `whatsapp.message.received.v2` referencia o BIGINT recebido como decimal canônico; v1 permanece compatível. A cadeia WhatsApp → Inbox → CRM → Inbox tem demonstração **PG17 descartável**, mas ainda não está ativada no Host, não passou pelo gate operacional nem foi homologada. Ver docs/engineering/ADR-EVENTS-WHATSAPP-INBOX-CRM-20261111.md e WBS-EVENTS-WHATSAPP-INBOX-CRM-20261111.md.
- Outbox do Control Plane é um domínio **separado** no schema `syndes_control.control_events`, alimentado por trigger em `tenant_module_audit`, migration offline 006. Nunca enviar eventos de negócio tenant para o Control DB ou aplicar migrations 001–006 sem backup/restore e aprovação. Ver docs/engineering/ADR-CONTROL-PLANE-EVENTS-20261111.md.
- Pré-flight de staging: `scripts/events/staging_preflight.py` executa exclusivamente SELECT em transações READ ONLY e probes HTTP locais. Serve para evidenciar bloqueios, **não** aprova backup/restore, autorização FGA, cutover nem deploy. O frontend visual pode ser inspecionado independentemente. Ver `docs/engineering/WBS-EVENTS-STAGING-UI-READINESS-20261111.md`.
- Restore drill: `scripts/events/disposable_restore_drill.py --disposable --ack-synthetic` usa apenas PostgreSQL 17 sintético em contêiner novo sem rede, compara Control/tenant ledgers após pg_dump/pg_restore e testa replay idempotente. **Não é restore operacional homologado**, não autoriza migration de Control/tenant nem alterações de serviço. ADR: `docs/engineering/ADR-EVENTS-DISPOSABLE-RESTORE-DRILL-20261111.md`.
- Worker admission/staging: `apps/core-host/src/platform-event-worker-admission.ts` exige acesso ENABLED do Control, org/workspace ativos e grant real da identidade service. `platform-event-worker-composition.ts` monta as assinaturas WhatsApp/Inbox/CRM **sem iniciar worker nem injetar bridge no Nest**. O adapter `platform-event-service-grant.ts` usa objeto OpenFGA `event_delivery` e principal `service:` distintos de usuário; **o modelo/tuples são candidatos, não aplicados no store operacional**. Nenhum fallback para JWT/claim/frontend. ADRs `docs/engineering/ADR-EVENTS-STAGING-WORKER-ADMISSION-20261111.md` e `ADR-EVENTS-OPENFGA-SERVICE-GRANTS-20261111.md`.
- Runner sintético: `scripts/events/run_disposable_staging.sh --disposable --ack-synthetic` inicia PostgreSQL 17 e OpenFGA descartáveis **somente com binding loopback** e exercita a cadeia completa. `TenantEventWorkerBatch` aceita no máximo 100 tentativas e não tem scheduler. **Nunca tratar esse teste como restore real, staging aprovado ou ativação do Host.** ADR `docs/engineering/ADR-EVENTS-DISPOSABLE-STAGING-20261111.md`.

## Gestão de Atendimentos no MVP (decisão 2026-11-11)

Gestão de Atendimentos Básica é módulo separado de CRM, Inbox e Syndes Support. É responsável por funil/etapas/protocolo/atribuição/auditoria; não reescreve mensagens nem gera equipes fictícias. O pacote `modules/service-management` possui domínio SM-02 e plugin/API Nest **opt-in e desativados por padrão**: não consta em `apps/core-host/config/modules.json`, sem UI, grants ou migrations operacionais. Sem templates, designer visual, motor genérico, SLAs avançados, transferências cross-org ou multi-org SQL002. Requer tenancy, Organization/Workspace membership, OpenFGA e Product Gate. O planner mainline ainda não roteia a suíte do novo módulo (incluindo Nest HTTP/PG17): SM-02D permanece com a frente responsável por CI, e CI verde genérico não equivale a PG17 service-management executado. Ver `docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md`, `docs/engineering/WBS-GESTAO-ATENDIMENTOS-MVP-20261111.md` e WBS 80 pós-MVP.
