# Candidato de integração Syndes — Base funcional + Support + Platform Manager

Estado: **candidato técnico para revisão e CI conjunta, NÃO release operacional**. Data: 2026-11-09.

## Encadeamento e branch única

- `main`: alvo final de código, ainda protegido por revisão, controles de produção e política de deploy.
- `integration/workspace-org-crm-c2-20261109` / [PR #27](https://github.com/delmacy/syndes-system/pull/27): base funcional com CRM, Inbox, WhatsApp, Organizations e Workspace, preservando SQL 002.
- `feat/syndes-support-20261109` / [PR #34](https://github.com/delmacy/syndes-system/pull/34): módulo Support, frontend isolado, Keycloak+FGA, CI browser e dump/restore descartável.
- `feat/platform-master-admin-console-20261109` / [PR #33](https://github.com/delmacy/syndes-system/pull/33): Platform Manager isolado, API Control DB read-only, Keycloak client separado, redes dedicadas.
- `integration/platform-support-preflight-20261109`: branch de integração criada em worktree próprio a partir da PR #27; merges explícitos das PRs #34 e #33, **sem conflitos** e sem modificar os HEADs originais. Seu PR de destino é o **`main`** em modo **draft**.

## Validação local do conjunto

Todos os `npm ci`, `check`, `build` e `test` declarados foram executados, conforme existam, para os 11 packages/aplicações: Core Kernel, Organizations, CRM, Inbox, WhatsApp, Support, Core Host, Support Web, Platform Manager API, Platform Manager Web e Workspace Web. Resultado: **INTEGRATION_ALL_PACKAGE_SUITES_PASS**, sem falhas. Testes que exigem PostgreSQL/Keycloak externos podem continuar marcados como skipped em ambiente Windows local: o gate de CI os executa com serviços reais descartáveis.

## Um único gate para entrar em main

`.github/workflows/integrated-release.yml`: pipeline de **fan-out/fan-in** obrigatório na revisão para `main`. Primeiro verifica ancestrais da base e dos dois produtos, depois exige a integridade byte-a-byte de `organizations/sql/002_legacy_single_context_gate.sql` e da ativação manual. Só após sucesso executa oito grupos de suites como **reusable workflows** (Core Host/Infra/Identity/Organizations, CRM, Inbox, WhatsApp MVP incluindo Go, Workspace, Platform Manager, Support+PostgreSQL+backup/restore, Support Browser E2E com Keycloak/FGA/PG). O job final recusa `failure`, `skipped` e `cancelled`: só passa se **todos** terminarem em `success`.

Os workflows originais passam a aceitar `workflow_call` sem perder seus gatilhos de desenvolvimento; isso preserva feedback por módulo, mas a promoção para `main` é **uma decisão única**. Não existem comandos de merge automático nem deploy. O gate não concede permissões de produção nem edita servers.

## Falhas e aprovações que o CI não resolve

- [ ] Revisão independente, aprovação dos PRs #27/#33/#34 e da integração.
- [ ] Verificar checks externos não-governados pela CI (por exemplo configuração Vercel legada com root inválido); corrigir ou remover pela governança, não ignorar falha silenciosamente.
- [ ] Product Gate da Issue #31 preservado; **não remover SQL 002**.
- [ ] [Gate #39](https://github.com/delmacy/syndes-system/issues/39): tenant Syndes e telefone exclusivo, secrets geridos, Keycloak clients separados, FGA/SQL grants auditados, backup real/restauração, smoke real, HTTPS e rollback.
- [ ] [Gate #37](https://github.com/delmacy/syndes-system/issues/37): métricas agregadas do Support no Platform Manager dependem de nova implementação/PR; jamais consultar tenant DB pelo Manager.
- [ ] Autorizar deployment com digest pin, janela, monitoramento e pessoa responsável. CI verde não é licença para cutover.

## Condições de publicação

Depois das revisões e do gate operacional, habilitar merge da release candidate no `main` respeitando dependências; etiquetar digest imutável; aprovar e executar release controlada. Em falha, reverter imagem e frontend ao digest aprovado, preservar banco de dados, fila, auditoria e SQL 002. Não utilizar merge do candidato sem confirmar política real de automação pós-main.
