# WBS 00.01–00.04 — Reconciliação de frontend à main canônica

Data: 2026-11-10. Baseline: `main` no commit `21b217064c0f261e74c25d6e3175c70820b6ef78`.
Worktree independente: `C:\workspace\syndes-mainline-ui-reconcile-20261110`, branch `integration/front-shared-manager-ui-20261110`.

## 00.01 — Estado de origem e regras

- A `main` já contém Core Host, CRM, Inbox, WhatsApp, Organizations, Support, Manager API/UI e Account Access, com CI central `.github/workflows/syndes-ci.yml`.
- O DevServer01 mantém uma prévia **somente visual** do Manager na Tailnet HTTPS 9446, baseada no bundle estático sem backend. **Não é deploy do HEAD**.
- A branch da PR #59 `d7669d9` divergira de `main`: baseline era `b7545a7` (Manager); havia 53 commits exclusivos na main e 5 no encadeamento de frontends.
- Regras: não reverter `main`, não reintroduzir workflows individuais, não modificar Keycloak/DB/servidores, não ativar multi-org, não implantar nova UI e manter Manager/Workspace com frontends, tokens e APIs separados.

## 00.02 — Verificação do histórico de PRs

| PR histórica | Constatação Git | Tratamento |
|---|---|---|
| #33 Manager (`b7545a7`) | O HEAD é ancestral de `main`, integrado indiretamente por #47 | Não aplicar novamente; preservar correções de rede, readiness e HTTPS já feitas depois |
| #34 Support (`0d66f19`) | O HEAD é ancestral de `main`, integrado indiretamente por #47 | Não aplicar novamente; preservar correções posteriores de SSE/estado |
| #51 Account Access (`8d4c3b0`) | HEAD **não** é ancestral, mas diff de conteúdo é vazio ao comparar com `main` nas pastas e schemas Account Access da PR; integração equivalente via #54 | Não repassar PR antiga; homologação de credenciais, AppRole e produto segue aberta |
| #56 Workforce (`2e00f31`) | Não integrado, PR draft independente | Fora deste incremento; reconciliar na WBS 00.05 |
| #57 visual-only, #58 front-shared e #59 UI modular | Cinco commits exclusivos sobre base antiga, sem mudanças intencionais em Auth/API real | Reaplicar somente esses cinco commits sobre `main` atual |

A paridade de #51 foi verificada nos paths `apps/account-access-api`, `infra/postgres/bootstrap/control-account-roles.schema`, `infra/postgres/bootstrap/control-account-delegation.schema`, `packages/core-kernel/src/account-roles.ts`, `tests/platform/account-roles-pg-smoke.sh`, `docs/engineering/ACCOUNT-ACCESS-FOUNDATION.md`. **Não** equivale a credenciais/DB operacional provisionados.

## 00.03 — Estratégia adotada

A worktree nova foi derivada da `main` em `21b2170`. Foram reaplicados cronologicamente, por `git cherry-pick` e **sem conflitos**, os cinco commits `6c6525b`, `5d646bd`, `0ad1499`, `9cc510e`, `d7669d9`. Os arquivos de CI central, scripts de runner e políticas de identidade/servidor da `main` foram preservados integralmente.

A operação resulta em commits novos com conteúdo equivalente, sem mesclar a árvore obsoleta em `main`. O conjunto contém exclusivamente o preview front-only, os componentes reutilizáveis e a modularização. **A imagem em operação não foi substituída.**

## 00.04 — Integração, qualidade e correção incidental

- `packages/front-shared`: única implementação de Button/Input/Badge/Card/Separator. Os dois aplicativos consomem o package, mantendo sessões e autorização independentes.
- `apps/master-admin-web`: App orquestrador, Shell, LoginScreen, OverviewPage, TenantsPage, TenantTable e ClientDrawer separados, apenas Visão geral/Clientes.
- `apps/workspace-web`: componentes locais antigos retirados, imports compartilhados; regras e telas CRM/Inbox/WhatsApp não reescritas.
- **Falha encontrada em teste simultâneo:** duas instalações `npm ci` do mesmo `packages/front-shared/node_modules` competiam, causando `ENOTEMPTY` e verificação parcial. Foi corrigida com trava de diretório atômica, rechecagem de dependências, limpeza em `finally` e limite de espera; sem editar workflows do Actions.
- **Teste de concorrência real:** shared `node_modules` removido apenas desta worktree de teste, builds Manager + Workspace iniciados simultaneamente, um único bootstrap instala dependências e ambos compilam. Lock removido no final.
- `npm ci` em ambos; Manager `npm test` **12/12**, build normal, E2E browser OIDC com fixtures, build visual e E2E desktop/móvel (sem chamadas protegidas) **PASS**; Workspace `npm test` **29/29**, build e lint **PASS** (avisos antigos não bloqueantes).
- `node --test scripts/ci/*.test.mjs`: **17/17 PASS**. Planner em impacto exclusivo `packages/front-shared/**` seleciona full regression fail-safe, portanto não exige alteração de Actions.
- PostgreSQL/Keycloak/OpenFGA e integração final serão revalidados pelo CI `Syndes Mainline CI` **no SHA da PR**, antes de qualquer merge. Gate operacional Manager/Support/multi-org continua separado.

## Termos de conclusão e pendências

- 00.01 e 00.02: inventário e comparação de ancestralidade/arquivos feitos, com evidências reexecutáveis.
- 00.03: branch reconciliada e dependências preservadas.
- 00.04: código e testes locais aprovados; **só marcar concluído após CI no head da PR e integração segura na `main` atual**.
- 00.05: Workforce #56 separado.
- 00.06: branches históricas irrelevantes a esta refatoração ainda requerem triagem.
- 00.07: frente de GitHub Actions mantém responsabilidade pelas alterações de workflows; nenhuma realizada aqui.
- Não proteger `main` administrativamente nem implantar servidores sem autorização e Product Gate.
