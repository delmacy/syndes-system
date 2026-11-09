# Syndes — reconciliação do candidato de main e gate único de regressão

Estado em 2026-11-09: **candidato técnico de revisão, não homologado nem implantado**. Branch `integration/platform-support-preflight-20261109`, PR #47 (DRAFT).

## Descoberta durante a promoção

`main` já integrara separadamente a fundação Core Kernel/Host, CRM e Inbox, e implementara `.github/workflows/syndes-ci.yml` com um planner de impacto/fan-out/fan-in. A primeira PR #47 (proposta pelo trabalho em branch) **não era mergeable** porque o histórico dos PRs empilhados adicionava novamente 39 arquivos existentes em `main`; também introduzia por engano um segundo orquestrador `integrated-release.yml`.

**Correção de arquitetura:** aproveitar o pipeline já implantado em `main`, não duplicá-lo. O candidato recebe `origin/main` por merge explícito com resolução `ort -X ours` dos arquivos de negócio duplicados, após inspeção da relação de 39 arquivos em conflito. O resultado staged dessa operação adiciona apenas o orquestrador mainline, scripts e documentação e remove o workflow antigo `integrity.yml` que a linha de `main` já substituiu. Nenhuma regra SQL 002 foi removida e as duas soluções continuam em frontends separados. **`-X ours` não é parecer de revisão; o resultado integrado continua sujeito a CI e revisão independente.**

## Gate principal, sem múltiplas promoções

`.github/workflows/syndes-ci.yml` é o único workflow principal de merge em `main`:
- `foundation`: estrutura, módulos/AGENTS, plano de testes, sintaxe e presença da trava física SQL 002;
- `impact`: seleciona testes por mudanças e propaga impactos de segurança a consumidores;
- `regression`: matriz de testes Core Kernel, Organizations, CRM, Inbox, WhatsApp TS+Go, Host, Workspace, Support e Platform Manager (aplicações e infraestrutura);
- `support-browser-parity`: suíte real de Chromium, Keycloak, OpenFGA, PostgreSQL e token de outro OIDC client, selecionada somente quando Support/Support Web é impactado (sempre no modo full);
- `platform-manager-parity`: suíte de PostgreSQL, Keycloak real, redes/ACLs e navegador do Manager, selecionada quando Platform API/Web/infra é impactado (sempre no modo full);
- `gate`: **só PASS se todos os jobs obrigatórios concluírem com sucesso**. Skips são aceitos somente para jobs que o planejador explicitamente não selecionou. Cancelamentos, falhas ou skip de suite exigida reprovam o merge.

Os workflows antigos de desenvolvimento continuam acionados por arquivos modificados para feedback por módulo e como documentação da paridade de release. `workflow_call` foi mantido **somente** nos dois grupos de prova externa até a migração integral da paridade. O segundo arquivo `integrated-release.yml` foi retirado deste candidato.

## Regressões executadas

Antes da reconciliação com `main`, no worktree isolado do Win1: 11 pacotes/apps passaram nos scripts `npm ci`, `check`, `build` e `test` existentes (Core Kernel, Organizations, CRM, Inbox, WhatsApp, Support, Core Host, Support Web, Platform API, Platform Web, Workspace). Após a reconciliação, planner mainline 10/10 testes e 14 workflows YAML válidos na análise local; validação CI combinada no PR #47 é obrigatória, especialmente identity+postgres+browser e condições de erro.

O script mainline `scripts/ci/run-suite.sh` amplia o ensaio Support com restauração real de dump sintético PostgreSQL. Ausência de fixture real em Windows local não constitui skip permitido para CI.

## Bloqueios que CI não resolve

- PRs #27/#33/#34 permanecem DRAFT, sem revisão humana independente; #47 não pode ser mesclada automaticamente.
- A política de `main` propõe PRs incrementais em ordem de dependências. A PR #47, que inclui centenas de commits da cadeia legada, é **candidata de prova de integração** e não atalho para passar sem auditar uma diferença extensa.
- Product Gate multi-org #31 mantém dois índices físicos SQL 002 e não libera ativação manual; singleton/SSE não pode ser estendido sem broker validado.
- Release do Support #39: não há tenant/WhatsApp Syndes provisionados na configuração operacional, grants FGA/filas, backup real restaurado, retenção, HTTPS e sign-off.
- Release do Platform Manager #33: primeiro owner, role SQL mínima, AppRole OpenBao, origins/rede isoladas, backup/smoke real e sign-off faltam.
- Agregados do Support no Manager #37: contrato ADR apenas, implementação exige autorização de acesso e PR separado.
- A integração Vercel antiga aponta para `apps/web` inexistente; seu status externo deve ser corrigido por governança, nunca ignorado silenciosamente.

**Não houve push a `main`, deploy em DevServer01, alteração de tenants, grants reais, chave/secret operacional nem remoção SQL 002.**

## Re-sincronização com `main` avançando em paralelo

O `main` recebeu o commit `8e639a3` (Workspace/CRM/Inbox UX) depois da reconciliação anterior. O segundo merge do candidato detectou conflitos em 25+ arquivos (Add/Add e content). A resolução automática conservadora `-X ours` **não foi suficiente**: ao comparar o índice com a árvore anterior, foram descobertas duplicações de `@Get("capabilities")`, `@Get("tags")`, DELETEs de vínculos CRM, `@Get("events")` SSE e `InboxService.watch()`. Os métodos duplicados não eram equivalentes: as versões novas vindas do histórico antigo **não exigiam `@SelectedScope`**, e a rota SSE usava somente o tenant, o que poderia enfraquecer isolamento. Todos esses métodos duplicados foram removidos, preservando versões com contexto organization/workspace e controle `scopeWriteAllowed`.

Criado `apps/core-host/test/reconciliation-regression.test.mjs` para impedir regressão: unicidade das rotas HTTP, capacidades CRM com escopo, SSE contextual e unicidade da autorização de stream. Resultado após reparo, no worktree Win1: **CRM, Inbox e Core Host check/build/test PASS**, Core Host 27 testes (incluindo novos), 0 falhas. A restauração PostgreSQL/Keycloak/Go e a matriz integrada do GitHub ainda são gates formais da candidata.

A árvore `main` continua sujeita a novos commits em paralelo. A PR #47 não pode ser mesclada enquanto seu `mergeable_state` estiver `dirty` nem substitui política de revisão incremental por sequência de dependências.
