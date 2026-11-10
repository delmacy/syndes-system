# Auditoria do módulo Core CRM — Syndes System

**Data:** 2026-11-10 • **Baseline auditada:** `main` em `afe057aa3028b61a0741feac71ab5b8d2ae9381e` • **Repositório:** `delmacy/syndes-system`  
**Escopo:** somente `modules/core-crm` e suas fronteiras com Core Host, Workspace e Organizations. **Tipo:** auditoria de código e documentação + testes locais; não é homologação de produção.  
**Planejamento mestre:** `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; aceite: `docs/product/CORE-CRM-MVP-ACCEPTANCE.md` e `CORE-CRM-FRONTEND-COMPLETION.md`. Este relatório **não cria nova WBS**.

## Decisão de estado

**IMPLEMENTADO E PARCIALMENTE TESTADO; PRODUCT GATE NÃO CONCLUÍDO; PUBLICAÇÃO INDEPENDENTE NÃO AUTORIZADA.**

O desenho de módulo confiável plugável no Core Host está implementado. A API contém CRUD de pessoas e empresas-contato, relações, tags, notas, perfis de funcionário, identidades externas, timeline, busca, CSV e capacidade por recurso. O Workspace mantém UI própria e há uma UI legada empacotada em `public/`. O plano vigente exclui deals, pipeline, lead scoring, IA no domínio e automação comercial.

A evidência é código compilado e testes locais, **não** acesso real de diferentes perfis Keycloak/OpenFGA, operação em tenants reais nem validação de rollout/restore.

## Mapa do código e responsabilidades

| Área | Arquivos / fonte | Evidência |
| --- | --- | --- |
| Contratos e domínio | `src/contracts.ts`, `service.ts`, `validation.ts`, `extra.ts` | Entidades, validação, regras e ações |
| Persistência | `src/postgres.ts`, `scope-query.ts` | SQL parametrizado, tenant e organização contextual; caminho legado ainda existe |
| Contexto seguro | `src/context-guard.ts`, `selection-header.ts` | Token/tenant verificado via Core Kernel, FGA `crm:context/read`, membership e backfill; negar antes de SQL do CRM |
| API | `src/crm.controller.ts`, `nest.module.ts`, `runtime.ts` | Rotas `/v1/tenants/:tenantId/crm/*`; capabilities, pessoas, organizações, notas, tags, funcionários, canais, CSV |
| Plugin | `src/plugin.ts` | `syndesPlugin` com módulo Nest, permissões, migrations e assets; referenciado no `apps/core-host/config/modules.json` |
| Banco de dados | `sql/001_crm_foundation.sql`, `002_crm_tags_notes.sql`, `003_crm_employees_channels.sql` | PK/FK compostas por tenant, associações, auditoria, funcionário e identidades de canais |
| UI legada | `public/crm.html`, `app.js`, `styles.css` | Arquivos estáticos publicados pelo plugin; não são o Workspace novo |
| UI Workspace | `apps/workspace-web/src/features/crm.tsx`, `crm-person-detail.tsx` | UI React desacoplada do pacote de backend, utiliza API |
| Testes | `modules/core-crm/test/*.test.mjs`, `pg-repo-integration.mjs`, `acceptance-journey.mjs`; `apps/workspace-web/tests/crm-ui-smoke.mjs` | Matriz parcial: unitários executados nesta auditoria; SQL/browser exigem verificação separada |

**Fronteiras:** `Person != UserAccount` e `Employee != Login`; autenticação é Keycloak; o CRM mantém a identidade canônica de contato; nomes de push de canal não sobrescrevem dados confirmados. As organizações de contato (`crm_organizations`) não são a mesma entidade que `platform_organizations`.

## Testes realmente executados no win1-server

A partir do checkout isolado da `main` acima:

| Execução | Resultado |
| --- | --- |
| `packages/core-kernel: npm ci && npm run build` | **PASSOU** |
| `modules/core-crm: npm ci` | **PASSOU** |
| `modules/core-crm: npm run check` | **PASSOU** |
| `modules/core-crm: npm test` | **25/25 PASSARAM** |
| `modules/core-crm: npm pack --dry-run` | **PASSOU**: 50 arquivos, ~39,2 kB; `dist`, 3 SQL e 3 assets web incluídos |

Os 25 testes cobrem autorização antes de selecionar DB, FGA indisponível, erro de tenant DB, contexto default/backfill, forwarding de organização confiável, registro de módulo, regras básicas de domínio, sanitização de CSV, buscas e guardrails de SQL de organização. **Não** comprovam banco real, execução com dois tenants, concorrência de transações, perfis OIDC reais, navegador real nem restauração de backup.

**Não executados nesta inspeção:** `test/pg-repo-integration.mjs`, `test/acceptance-journey.mjs` (PostgreSQL), testes browser/Workspace e migrations reais. Docker CLI não estava disponível no contexto PowerShell utilizado; ausência de execução não é falha do CRM. Exige execução via CI/ambiente descartável antes de fechar gate.

## Bloqueios e divergências por prioridade

| ID | Prioridade | Divergência / risco comprovado | Aceite necessário |
| --- | --- | --- | --- |
| CRM-01 | **P0 — segurança** | `context-guard.ts` suporta contexto default/selecionado, mas fluxos legados diretos ainda admitem caminho de escopo tenant sem organização; multi-org não está liberado | Testes negativos reais de todas as entradas diretas CRM/Inbox/WhatsApp e não remover índices SQL 002 até gate específico |
| CRM-02 | **P0 — operação** | README e Product Gate afirmam explicitamente ausência de homologação com usuários reais Keycloak, papéis OpenFGA e tenants separados | Ensaio browser + chamadas HTTP diretas com perfis distintos, revogação e FGA indisponível; evidenciar 401/403 e isolamento |
| CRM-03 | **P0 — integração** | `modules/organizations` requer migrations/backfill e `crm:context/read` antes da nova API; rollout parcial pode transformar acesso legítimo em 403 | Plano de migração/rollback ordenado, backup testado e grants revisados, sem remover SQL 002 |
| CRM-04 | **P1 — produto** | Frontend Workspace consta como implementado com mocks; Product Gate de usabilidade, acessibilidade e jornada real segue aberto | Homologar criar/editar/arquivar/vínculos/tags/CSV/canais/mobile com identidade real e dados demo segregados |
| CRM-05 | **P1 — dados** | Há testes SQL na árvore, mas não foram executados nesta auditoria; concorrência, transações e escala não foram aqui demonstradas | CI PostgreSQL descartável com dois DBs, schemas/migrations idempotentes, rollback, volume/paginação, audit atomicidade |
| CRM-06 | **P1 — distribuição** | `@syndes/core-crm` e `@syndes/core-kernel` são `private: true`; CRM usa `file:../../packages/core-kernel` | Não publicar ainda. Quando o pacote for distribuível, versionar dependência no registry, validar consumidor externo e manter `./plugin` compatível |
| CRM-07 | **P1 — package interface** | `npm pack --dry-run` contém arquivos, mas instalação independente não foi testada; Nest/React/SQL precisam de critérios próprios | Instalação em projeto realmente isolado, imports `.` e `./plugin`, SQL/assets resolvidos, peer dependencies e Node compatíveis |
| CRM-08 | **P2 — design** | UI legada `/crm` e UI Workspace coexistem; possível custo duplo de manutenção e fluxos divergentes | Definir UI oficial para produção (Workspace), manter legada apenas conforme migração aprovada; não duplicar componentes de frontend |
| CRM-09 | **P2 — permissões** | Permissões FGA atuais são `read/write` por recurso; não há autorização granular `create/update/archive` | Validar matriz de papéis por recurso/ação no Product Gate; granularidade adicional requer decisão de produto, não suposição |

## Plano de alinhamento e fechamento — somente CRM

1. **Congelar contratos e baseline:** conferir API/plugin, migrations e fluxos Workspace no SHA integrado; manter CRM source-of-truth para contatos e evitar código duplicado de usuário/funcionário.
2. **Validar DB/segurança real:** executar cenários PostgreSQL A/B, org A/B, guard de contexto e operações negativas; exigir testes de vínculo e exportação sem vazamento.
3. **Conferir Host + organizações:** garantir ordem de migrations, backfill auditado, FGA `crm:context/read`, compatibilidade com Core Host e SQL 002 ativa. Nenhum deploy sem rollback.
4. **Homologar Workspace:** navegador com Keycloak e perfis reais, ações diretas negadas, CSV, duplicidade, timeline, acessibilidade, mobile e edição concorrente.
5. **Revisar o ciclo do pacote:** estabilizar `exports`, `.d.ts`, tipos, assets, dependências e versão; **não** mudar provider, UI e core dentro de uma refatoração de packaging.
6. **Publicação somente após decisão:** usar `delmacy/syndes-system` como origem, delegar alterações na CI existente à frente de workflows, escolher namespace autorizado, instalar num consumidor independente e testar rollback.
7. **Product Gate:** atualizar os documentos existentes com artefatos, SHA, CI, aceite de segurança e demo. `DONE` somente com evidência de operação.

## Restrições respeitadas

- Não modificamos código funcional, testes, esquemas SQL, pipelines, regras de proteção do `main`, dados reais ou deployments.
- Não removemos SQL 002, não habilitamos multi-org, não publicamos no GitHub Packages.
- A análise de CRM é independente das auditorias futuras de Inbox, WhatsApp e demais módulos, que deverão seguir o mesmo formato e se referir à WBS mestre.
