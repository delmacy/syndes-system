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

## E2E Keycloak — campos de perfil obrigatórios
A execução com Chromium real alcançou o formulário do Keycloak e exigiu `email`, `firstName` e `lastName` para os usuários de fixture, bloqueando o retorno PKCE ao frontend. Criado inicialmente um teste de regressão em `apps/support-web/tests/auth.test.mjs`, observado falhar por ausência de email; adicionados dados sintéticos completos para os três usuários no realm. Reexecução local: 6/6 testes frontend, TypeScript e Vite build aprovados. Ainda requer resultado positivo do workflow E2E para `VERIFIED`.

## E2E OIDC — audiência do JWT rejeitada corretamente
Os traces do navegador confirmaram tokens Keycloak (employee, agent e outsider) com issuer e assinatura, mas sem `aud=syndes-e2e-api`. O `ActorVerifier` do Host respondeu 401 de modo fail-closed. Causa: mapper Keycloak de fixture usava `included.client.audience` apontando para cliente inexistente. Alterado para `included.custom.audience` e adicionado teste de regressão em `apps/support-web/tests/auth.test.mjs`, observado falhar antes do fix e passar depois. Testes locais frontend 6/6, typecheck e build verdes; reexecução E2E completa pendente de nova CI.

## E2E: fluxo autenticado avançou até criação de chamado interno
A CI com mapper `included.custom.audience` validou login Keycloak real para employee/agent/outsider e alcançou a criação de chamado interno com retorno de sucesso. O teste Playwright falhou em seletor genérico `getByRole('status')`: encontrou simultaneamente a confirmação 'Chamado registrado.' e 'Carregando chamado…'. Corrigido o locator para a confirmação específica; não houve mudança de produto nem remoção de assertions. A conclusão integral do E2E permanece pendente.

## E2E — transição de estado e nota interna validadas no fluxo
A execução Playwright com Keycloak/OpenFGA/PG real passou pelos fluxos de autenticação, criação interna, nota de atendente e alteração de status; o teste parou por localizar a opção `<option value=triage>` oculta, não o badge de estado. Localizador atualizado para badge de status visível no painel de detalhe. Nenhum teste foi removido ou marcado como skipped.

## Marco de validação E2E — CI verde (09/11/2026)
**Referência funcional:** commit `d48a50bf1247d91f7f9dac9e8c55744efd2cda82` da PR #34 (draft). O GitHub Actions `Syndes Support Browser E2E (disposable)` concluiu com **1 Playwright E2E PASS, 0 FAIL** em `https://github.com/delmacy/syndes-system/actions/runs/42657311731`; também passou na execução `42657295008`. A suíte utiliza o Chromium real, Keycloak 26.8.1 em TLS efêmero, OpenFGA 1.22.1 e PostgreSQL 16 descartável. Testa três identidades (funcionário, atendente e outsider), autenticação OIDC PKCE e JWT com audience, 401 anônimo, 403 por identidade sem autorização, abertura interna, histórico do solicitante sem nota privada, atendimento por membro de fila, alteração do estado, e abertura externa via conversa Inbox/CRM/WhatsApp sintéticas.

**Outras suites no mesmo commit `d48a50b`:** `Syndes Support CI` (unitários + PostgreSQL real), `Syndes Support Web CI`, `Core Inbox CI`, `Core Host and Infrastructure CI` (inclui scripts de isolamento do instalador), `WhatsApp Core Receiver CI`, `WhatsApp MVP Gate` e `Support Browser E2E`: todos os sete workflows relevantes concluídos com sucesso. Isso **não** equivale a aprovação humana do merge nem deployment. A WBS foi atualizada com `VERIFIED` onde existem evidências de testes; itens 4.1, 8.3 e 8.5 permanecem com bloqueios operacionais, e a revisão independente do PR não está concluída.

**Arquivos do avanço:** `infra/postgres/bootstrap/{support-migration-gate.sh,migrate-modules-tenant.sh}`; `tests/platform/support-migration-{gate,installer}.test.sh`; `apps/core-host/test/support-e2e-server.mjs`; `apps/support-web/e2e/{support.spec.mjs,syndes-support-e2e-realm.json}`; `apps/support-web/tests/auth.test.mjs`; `apps/support-web/playwright.config.mjs`; `.github/workflows/{support-browser-e2e.yml,core-host-infra.yml}`; `docs/engineering/{SYNDES-SUPPORT-E2E.md,WBS-SYNDES-SUPPORT.md,SYNDES-SUPPORT-EXECUTION-REPORT.md}`. Correções por commits `f629a5f`, `6379705`, `dc1bc50`, `996aa23`, `d5dbee6`, `b0d849a`, `8c736a5`, `de1ec32` e `d48a50b`. Nenhum deploy, migração real de tenant comercial, merge ou mudança de SQL 002.

## Fechamento técnico ampliado — controles do release (09/11/2026)

**Commits de código:** `116b6aa` (ensaio de backup/restauração/rollback em PostgreSQL descartável), `a49e7f9` (entrada Docker stdin corrigida e auditoria SQL append-only para eventos e memberships), `448b5e2` (verificação `azp=syndes-support-ui`, inclusive controle negativo de token Keycloak válido com mesma `aud` emitido para outro client OIDC).

**Provas de CI:** No commit funcional `448b5e2fb07cb2913f3b5e5d1b959b2034931668` foram concluídos com sucesso **sete workflows**: Syndes Support CI (unit+PG+restore real sintético), Support Web, Support Browser E2E (Chromium+Keycloak+OpenFGA+PG), Core Host and Infrastructure, Core Inbox, WhatsApp Receiver e WhatsApp MVP Gate. E2E `https://github.com/delmacy/syndes-system/actions/runs/42663609903`. Backup/restore `https://github.com/delmacy/syndes-system/actions/runs/42663610074`. Esses checks não usam dados de produção.

**Inspeção operacional apenas de configuração:** dois containers Core Host do DevServer01 ativos não tinham `SYNDES_SUPPORT_TENANT_ID` nem `SYNDES_SUPPORT_WHATSAPP_ACCOUNT_ID` definidos, e `SYNDES_MULTI_ORG_ENABLED` não estava ativo. Nenhum segredo/ID foi exposto; nenhuma mudança no servidor, DB, rede, Keycloak, WhatsApp, OpenFGA ou deploy.

**Pacote de revisão:** `SYNDES-SUPPORT-SECURITY-REVIEW.md` (ameaças, provas e riscos), `SYNDES-SUPPORT-RELEASE-GATE.md` (checklist para autoridade de release), `ADR-SUPPORT-PLATFORM-MANAGER-AGGREGATES.md` (evolução separada, **não implementada** para respeitar PR #33). A WBS recebeu estados distintos: software/CI e simulação de backup VERIFIED; deploy real e agregados continuam BLOCKED.

**Gates humanos não substituíveis:** revisão independente por pessoa responsável, dependência de merge PR #27 e aprovação PR #34, definição e prova de tenant Syndes operacional, conta dedicada WhatsApp, Keycloak/OIDC reais, grants e filas revistos, origem HTTPS isolada, política de retenção, backup real com ensaio de restore, rollback operacional e aceite explícito. A Issue #31 e a trava SQL 002 seguem intactas. Não atribuir estado DEPLOYED antes dessas evidências.
