# Syndes Support — Registro de execução 2026-11-09
Base verificada: `integration/workspace-org-crm-c2-20261109` @ `8e2fb5d1f0e0bc110d2ff82e36303b734ee6f1f9`. Branch de trabalho: `feat/syndes-support-20261109`. Issue #32; não houve merge de #27, deploy, migração de dados reais nem ativação da issue #31.

## Implementado em código
- **WBS 1.1–1.3:** inspeção de repositório, issues, branches, estrutura, baseline em cópia isolada e ADR, sem tocar trabalho paralelo do Platform Manager.
- **WBS 2.1–2.5:** domínio `modules/support/src/domain.ts`; migrations versionadas `001_support_cases.sql`, com filas segregadas, trilha de tickets e auditoria de grants/revokes com triggers, além da validação de estados. Contratos PRD/ADR/API e matriz de permissões.
- **WBS 3.1–3.4:** serviço, DTO, SQL com filtros (tenant, kind, requester/queue), CoreKernel+FGA, Host Nest/rotas, auditoria atômica e políticas negativas.
- **WBS 4.2–4.4:** caso externo por conversa WhatsApp Syndes e contato CRM Syndes, conta configurada no servidor, operações de status, nota interna jamais outbound, reabertura. **4.1 não provisionado**: conta WhatsApp Syndes real requer gate operacional.
- **WBS 5.1–5.3:** formulário interno autenticado, filas privadas, autorização de solicitante/agente e histórico segregado.
- **WBS 6.1–6.4:** `apps/support-web` independente, PKCE Keycloak com client ID exclusivo, lista/filtros/detalhe/histórico/formulários reais, ações de operador autorizadas por backend; sem dados fictícios distribuídos, menus novos ou dashboards inventados.
- **WBS 7.1,7.3:** regressão local; **7.2** PostgreSQL real **PASS** em GitHub Actions; **7.4** E2E real de navegador e IdP pendente; **7.5** CI de suporte, UI, Inbox e infraestrutura passou; demais jobs de Core Host/identidade requerem confirmação final.
- **WBS 8.1–8.4:** docs de operação e rollback criadas, sem execução de rollback real porque nenhum deploy foi feito.

## Evidência local
- Baseline anterior às alterações, `npm ci && npm test` em **seis** pacotes: packages/core-kernel, modules/core-crm, modules/inbox, modules/whatsapp, modules/organizations, apps/core-host; **seis suítes com exit 0**.
- `modules/support: npm run check && npm test` — **14 PASS**, 1 PG **SKIP** por falta de banco descartável local. Esse SKIP é explícito e **não é aprovação de persistência**.
- `apps/core-host: npm run check && npm test` — **23 PASS** incluindo HTTP negative e plugin/migration descriptors.
- `apps/support-web: npm run check && npm test && npm run build` — **5 PASS**, Vite bundle construído; autenticação real Keycloak não foi exercida.
- `git diff --check` sem violações relevantes. Workflows de CI ainda não possuem status de execução até publicar a branch.

## Bloqueadores e critérios antes de homologar
1. Executar `support-postgres` na CI com PostgreSQL real: replay de migrations, cross-tenant, grants/retirada, notas e WhatsApp vínculo, inclusive comportamento transacional. Corrigir falhas pela causa, acrescentar testes; nenhuma migração destrutiva.
2. Executar CI do Host completo, Docker build, regressões que tenham sido tocadas, frontend; revisar findings e eventuais failures.
3. Validar UI e Keycloak *syndes-support-ui* com identidade/config reais em **ambiente de homologação autorizado**; E2E navegador + backend real em banco descartável. Não elevar testes mockados a E2E real.
4. Revisar provisionamento de tenant Syndes e conta WA exclusiva, OpenFGA/memberships filas e isolamento frontend no reverse proxy; sem privilégios implícitos.
5. Revisão independente do PR e autorização formal de release. #31 não deve ser ativada por este PR.

**Sem go-live.** PR: https://github.com/delmacy/syndes-system/pull/34 (draft). Commit corretivo: `9685fc3ae53a138decb0aa40eb7ee1c69a5a36a9`. No commit funcional `9685fc3`, CI final com **22 checks PASS, zero FAIL e 1 SKIP esperado** (job exclusivo de PR ignorado no push); inclui Core Host, integração de identidade, Inbox, WhatsApp, organizações, PostgreSQL descartável e infraestrutura. O commit de documentação posterior não altera código. Ainda faltam E2E reais de interface/IdP em homologação e gates operacionais.

## Retificação de isolamento detectada na revisão pós-PR
A auditoria de continuidade identificou que o instalador genérico enumerava a migration `support/001_support_cases` para todos os tenants. Corrigida a elegibilidade em `infra/postgres/bootstrap/support-migration-gate.sh` e em `migrate-modules-tenant.sh`, com teste negativo dedicado (sem configuração, UUID inválida, tenant comercial, tenant Syndes e módulos legados). O teste Git Bash local passa. A confirmação de CI será registrada separadamente; não houve migração de banco de clientes.

## Teste do instalador completo (mocks, sem Docker real)
O teste `tests/platform/support-migration-installer.test.sh` executa o **script operador verdadeiro**, substituindo somente Docker e jq por instrumentos sem rede que capturam as emissões SQL. Verifica CRM preservado no tenant comercial, Support não emitido para tenant comercial ou sem configuração e Support emitido somente para o tenant operacional Syndes. Git Bash local: PASS. Esse teste não utiliza dados reais, e não substitui as integrações PostgreSQL existentes.

## Primeira execução E2E: incidente de fixture resolvido
O primeiro workflow Playwright falhou na etapa de importação Keycloak, antes de executar código do Support. A reprodução em Keycloak 26.8.1 descartável identificou: `File name / realm name mismatch`. Corrigido o nome para `syndes-support-e2e-realm.json` e adicionada preservação de logs/diagnóstico no workflow. A validação E2E continua condicionada à nova execução; essa falha não foi ocultada como skip.

## E2E: corrigido setup de runtime efêmero
A execução após correção do Keycloak comprovou importação do realm, execução das migrations no PostgreSQL e configuração OpenFGA/Nest HTTP, mas falhou na preparação do frontend: o diretório `apps/support-web/public/` não existia em checkout limpo (pastas vazias não são versionadas). O workflow agora cria o diretório antes de gravar `support-runtime.json` de fixture. O teste também força reload e nova consulta SQL antes de verificar que o solicitante não recebe notas internas.
