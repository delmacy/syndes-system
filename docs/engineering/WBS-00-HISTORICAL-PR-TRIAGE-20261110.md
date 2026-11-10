# WBS 00.06 — Triagem das branches históricas (10/11/2026)

**Baseline:** `main` em `7f92901bd84b9816f7cd646ca2988fe535360f1d` após integração [PR #62](https://github.com/delmacy/syndes-system/pull/62). **Escopo:** inventário e decisão, sem merge/cherry-pick/deploy nem deleção de branches. Em todos os casos abaixo, os HEADs de PRs antigas **não** são ancestrais de `main`.

| PR | SHA histórico | Commits exclusivos da branch (vs. main) | Topologia antiga | Decisão | Necessidade ainda aberta |
|---|---|---:|---|---|---|
| [#1](https://github.com/delmacy/syndes-system/pull/1) | `49a8013d` | 5 | `.github/scripts/` e `.github/workflows/agent-ci-audit.yml` | **Não integrar** a pipeline antiga em paralelo à atual `syndes-ci.yml`; reavaliar proveniência de agentes como requisito próprio de governança | A exigência de manifest/proveniência de agente não está comprovadamente implementada pela atual política. Se necessária, especificar na frente responsável por CI (WBS 00.07 / 95.01), sem ressuscitar Actions por PR |
| [#2](https://github.com/delmacy/syndes-system/pull/2) | `b867dee6` | 41 | `apps/api`, `apps/web`, `services/whatsmeow` | **Não portar** código de serviço descontinuado; gateway atual é `modules/whatsapp/gateway/whatsmeow` com `qrSessions` isolados por `accountID` | Confirmar **em ambiente real** renovação de QR e vínculo ao tenant sem cruzamento de conta; WBS 50.05–50.06 |
| [#3](https://github.com/delmacy/syndes-system/pull/3) | `3d76d149` | 80 | dashboard NextAuth `apps/whatsapp-admin`, gateway SQLite `services/whatsapp-gateway` e workflows isolados | **Não ressuscitar** segundo control plane/gateway nem workflows; subsistema atual é módulo WhatsApp + Workspace + Go Gateway | Homologar pareamento/envio/recebimento/segurança de canal em WBS 50.05 e revisar gaps de operação antes de novos recursos |
| [#7](https://github.com/delmacy/syndes-system/pull/7) | `5205df0f` | 23 | Inbox anterior `modules/inbox` sobre base CRM antiga | **Não mesclar** branch defasada; `main` contém Inbox, scope query, realtime e serviços atuais | Regressão real de fila, histórico, SSE e atendimento humano em WBS 50.03–50.04 |
| [#50](https://github.com/delmacy/syndes-system/pull/50) | `be473c0e` | 12 | Organizations em base anterior com readiness/SQL | **Não reaplicar**: `main` possui `modules/organizations`, migrations 001–006, trava SQL 002 e testes atuais; a fundação Workforce 007 também foi integrada por #62 | Gate de habilitação multi-org permanece na issue #31 / WBS 60.01–60.08; não remover SQL 002 automaticamente |

**Método:** PRs consultadas no GitHub (estado, arquivos e descrição); SHAs históricos consultados por `git cat-file`, `git merge-base --is-ancestor`, `git rev-list --left-right --count origin/main...<sha>` e `git ls-tree` em checkout local. As divergências não são uma medida de features faltantes, pois o código evoluiu em outras branches e a arquitetura mudou.

## Política de encerramento

- As cinco PRs já estavam **closed, sem merge próprio**. Preservar suas branches e registros; não fazer `git branch -D`, `git push --delete` ou cherry-pick direto.
- Não classificar automaticamente requisitos de QR, proveniência CI ou atendimento como concluídos só porque existe outro módulo. O item remanescente fica atribuído ao WBS indicado na tabela.
- **Regressão da base integrada:** [CI `main` após PR #62, run 42873397138](https://github.com/delmacy/syndes-system/actions/runs/42873397138) **23/23 jobs SUCCESS**, incluindo Organizations PG real, Keycloak, FGA, Core Host, Workspace, Inbox, WhatsApp e Support; não prova funcionalidades comerciais/operacionais ainda sem E2E de homologação.

**Conclusão de 00.06:** branches históricas catalogadas; todas devem ficar como referências, não como candidatos a merge direto; riscos comerciais e de governança preservados no backlog. Nenhum software foi removido e nenhum workflow alterado.
