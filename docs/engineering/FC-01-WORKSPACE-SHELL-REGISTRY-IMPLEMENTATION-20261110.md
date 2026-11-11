# FC-01 — Shell/registry/contexto do Tenant Workspace

Baseline: main a884e6c3eaa71c9723d628700e199a6e8fc04258, 2026-11-10. Escopo FC-01.01, FC-01.03 e fatia inicial FC-01.02. Esta fatia NÃO introduz novas telas, módulos, APIs, credenciais, direitos ou deploy.

## Implementação

1. O App.tsx passa a orquestrar autenticação Keycloak PKCE, TenantApi e o WorkspaceShell. WorkspaceShell contém a mesma sidebar, toolbar, header, footer, seletor e menus, sem mudanças de interface.
2. O feature-registry.ts descreve exclusivamente as quatro views atuais: overview, inbox, crm, settings. O use-hash-view.ts mantém o contrato de navegação #view, rejeita views desconhecidas e a navegação principal continua a mesma. WorkspaceFeatureOutlet monta somente as features React existentes; CRM/Inbox continuam bloqueados visualmente para visitantes.
3. O use-active-workspace.ts isola o diretório e a seleção da identidade exata de TenantApi, ignora respostas assíncronas obsoletas, impede escolher escopos ausentes da listagem autorizada e força remount por troca Org/Workspace; logout remove API/escopos de exibição. Fallback tenant-only legado permanece até gate multi-org #21/#31.
4. Nenhum componente duplicado em front-shared e nenhum frontend dentro dos pacotes NestJS. apps/workspace-web/AGENTS.md documenta a fronteira para outras frentes.

## Testes

- npm run build --prefix apps/workspace-web: compilação TypeScript e bundle de produção aprovados localmente.
- npm test --prefix apps/workspace-web: 32/32 aprovados, incluindo testes novos de registry, hash inválido, menu estático e separação de responsabilidades.
- npm run lint --prefix apps/workspace-web: 0 erros; advertências já existentes em outros arquivos, nenhuma nos arquivos FC-01 depois da correção de hook.
- Preview isolado 127.0.0.1:18095: shell-context-browser.mjs passa com Keycloak/token fictícios e APIs mockadas em Playwright. Verifica escopos A/B, headers Org/Workspace distintos, descarte de contato da outra empresa, logout, seletor removido e fallback de hash desconhecido.
- Preview isolado: anonymous-smoke.mjs passa com navegação e guardas de CRM/Inbox. Estes testes de mock NÃO equivalem a homologação com OpenFGA/Keycloak/DB reais.
- Mainline CI no SHA exato é gate antes da integração, não deve ser inferida de testes locais.

## Pendências e honestidade de escopo

FC-01.02 **parcial**: o remount e o bloqueio de resultado obsoleto do diretório estão cobertos, mas cancelamento de todos os GETs em voo das features e testes de SSE concorrente dependem de mudanças nos clients e hooks do CRM/Inbox; ainda não declarar este item DONE. O fallback tenant-only ainda existe sob SQL 002 e não é isolamento multi-org completo.

FC-02 pendente: registry visual não autoriza nada; handlers e workers antigos ainda usam CoreKernel.execute sem o gate de ModuleAccessPort. Nenhum entitlement realmente foi ativado pelo frontend.

FC-03 e Manager pendentes: Account/Organization não ganharam telas novas ou placeholders; Manager continua app e infraestrutura separados. Bancos operacionais não foram modificados, sem mudanças de JWT, OpenBao, FGA, scripts de CI ou GitHub Actions.

Próximas tarefas: completar abort + generations em API/SSE, mapear e bloquear controllers/worker via ModuleAccessPort, criar read model tenant-safe de capabilities e só então tornar a navegação dependente de módulos ENABLED.
