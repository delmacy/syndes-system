# WBS 00.05 — reconciliação DC-2c (Workforce) com a main

Baseline: 2026-11-10. Branch: `integration/workforce-dc2c-20261110`.
Base da integração: `main` em `89772e98ca0eea90f0cdcbc5b379402505bcf260`.
Fonte: PR [#56](https://github.com/delmacy/syndes-system/pull/56), commits `686f43c` e `2e00f31`.

## O que foi verificado

- Os **dois commits** exclusivos da PR #56 foram reaplicados, em ordem, sobre a `main` vigente por cherry-pick **sem conflitos**. Não foi efetuado merge de branch antiga de integração nem alterado CI.
- `WorkforceService` é serviço de domínio **não publicado em HTTP**. Usa `CoreKernel.execute` para membership de tenant + OpenFGA `organizations:staff` antes de resolver tenant DB. Todas as mutations exigem administrador ativo da organização e workspace no mesmo SQL.
- `platform_staff_identity_links` conecta CRM Employee UUID a principal de identidade, **sem inferir que employee UUID é Keycloak `sub`**. A validação de `sub` real, convites, concessões FGA, migração de banco e API HTTP estão na WBS 30.05–30.11.
- `platform_workspace_staff_roles` define `supervisor/agent/viewer` somente como **designação de negócio**, não autorização de leitura de mensagens/CRM, nem elevação implícita de Account Owner ou Platform Owner.
- `platform_staff_teams`, vínculos e membros de equipes são dados locais do tenant. Equipe não concede acesso por si. Identidades, designações e ações registram auditoria append-only na transação.
- Migração **`007_staff_roles_pre_release.sql` é manual, aditiva e NÃO registrada na lista de migrations do plugin**; o teste automatizado verifica essa invariância. Requer CRM Ownership 003 e os **dois índices SQL 002 ativos**. Nenhum SQL foi executado em banco operacional e nenhuma estrutura foi ativada em tenant real.
- Triggers impedem mutações diretas de tenant/org/workspace/principal e promoção de viewer técnico a cargo supervisor/agent. Falhas de FGA e de associação cross-tenant devem negar acesso.
- O estado da imagem visual do Manager em DevServer01 não é alterado: container `syndes-platform-manager-visual` na HTTPS Tailnet `:9446`, demo local e API admin 503. A menção ao antigo `syndes-platform-manager-preview` na documentação original descreve a prévia inicial de 09/11, substituída pelo demo atual.

## Evidência e gates

- Unitários Organization/Workforce: `npm ci && npm run build` em kernel/CRM seguidos de `npm test` em Organizations, com cinco testes PG sinalizados como `SKIP` **somente no Windows sem fixture**.
- CI central impacta todas as suítes pois `modules/organizations/**` é fronteira de segurança compartilhada. O job Organizations usa PG16 descartável, cria banco `syndes_wf_ci_*`, testa idempotência, A/B, vínculo identidade, revogação e travas SQL 002; CI do PR deve ser verde antes de integrar.
- Novo teste de contrato confirma que `007` não é migration automática, sem `DROP INDEX` SQL 002, sem bootstrap de membros e sem PUBLIC DML grants.
- Workflow de GitHub Actions, manifest de migrations, dados operacionais, PRs de Platform Manager, `main` e deploy permanecem intocados até integração formal.

## Limites / próximas WBS

A integração da *fundação* DC-2c não equivale à funcionalidade de colaboradores pronta. Após merge e CI do push main, WBS 00.05 pode ser encerrada. WBS **30.05–30.11** continua bloqueada para revisão de migração do tenant, endpoint HTTP com audience dedicada, FGA por recurso, aceite do convite Keycloak, revogação, telas do Workspace e E2E de atendimentos. A implantação da primeira conta Syndes fica na WBS 40, sem habilitar multi-org automaticamente (gate #31).
