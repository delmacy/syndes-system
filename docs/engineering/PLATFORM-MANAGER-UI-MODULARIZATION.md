# Platform Manager — UI modularizada (incremento pós front-shared)

**Data:** 2026-11-09
**Estado:** PR dependente de #58, sem merge, sem deploy ou mudança de configurações operacionais.
**Branch de trabalho:** `feat/platform-manager-ui-next-20261109`, worktree em `win1-server`.

## Objetivo

Reduzir o acoplamento do frontend independente do Platform Manager, mantendo rigorosamente as **duas telas já implementadas**: Visão geral e Clientes. Nenhuma UI de operações de tenants, billing, gestão de funcionários, novas permissões ou atalhos foi criada. Os componentes comuns continuam em `@syndes/front-shared`, não existem clones locais.

## Nova organização

- `src/App.tsx`: orquestração de autenticação, token de sessão de Manager, verificação `/me` de operador autorizado, consultas por API central e carregamento/pesquisa/paginação; controla seleção de tenant e revogação da sessão. O Manager continua **sem** receber credenciais ou contexto do Workspace.
- `src/app/ManagerShell.tsx`: composição de sidebar, menu móvel, cabeçalho, refresh, footer e banner de prévia visual. Recebe estado e callbacks por props; não conhece Keycloak, bearer, tenant DB ou endpoints.
- `src/app/view.ts`: contrato de **duas** visualizações autorizadas.
- `src/auth/LoginScreen.tsx`: componente presentacional de entrada, com callback para a função de autenticação que continua em `src/auth.ts`. Nenhum bypass no build normal.
- `src/features/overview/OverviewPage.tsx`: cartões de métricas e cinco tenants recentes obtidos do catálogo sem filtros; não acessa APIs nem permissões diretamente.
- `src/features/tenants/TenantsPage.tsx`: diretório com busca, filtro de status, paginação e tabela. Os filtros continuam aplicados no serviço de orquestração, preservando `page=1` em mudanças de filtro.
- `src/features/tenants/TenantTable.tsx`: apresentação somente leitura de linhas e ação de abrir detalhes.
- `src/features/tenants/ClientDrawer.tsx`: detalhes do tenant, com **nova chamada** `api.tenant(id,signal)`, cancelamento de requisição ao desmontar, e sem acesso ao banco do cliente.
- `src/features/tenants/tenant-presentation.tsx`: apresentação de status/nome/data do tenant. É específica do domínio Manager, não deve ser colocada no `front-shared`.

## Segurança e isolamento

A autenticação continua sendo `authorization_code` com PKCE para a origem Manager; a autorização de operador passa por `api.me` antes de exibir informações administrativas. A prévia estática sem login continua compilada **somente** em `--mode visualpreview` com itens claramente identificados `[DEMONSTRAÇÃO]`, sem chamadas de Keycloak e sem API. Os componentes extraídos **não** geram tokens, não concedem roles, não alteram permissões nem tornam os dados dos clientes acessíveis à plataforma.

O frontend Manager, sua origem/porta HTTPS 9446 e client OIDC seguem independentes do Workspace e dos tenants. Não instalar a prévia no backend real, não abrir `/v1/platform/admin` para dados fictícios e não provisionar owner sem identidade aprovada.

## Critérios de aceite

1. `npm ci`, `npm run build` e `npm test` no Manager; os testes de contrato agora inspecionam os módulos concretos, a única rota de clientes e a chamada dedicada de detalhes.
2. `npm run test:browser`: fixture OIDC/PKCE, lista recente independente dos filtros, busca, detalhes reais pelo endpoint mockado, logout e 403 para operador sem autorização.
3. `npm run build:visual-preview` e `node tests/visual-preview-e2e.mjs`: demo sem login, pesquisa, filtros, detalhes, navegação desktop e **menu mobile**, zero exceções de JavaScript e zero requisições protegidas.
4. `Workspace` continua compilando e executando testes de escopo de tenant e OIDC com componentes consumidos do mesmo `front-shared`.
5. Comparação de screenshots locais `1440×1080`: captura do Manager da PR #58 **pixel a pixel idêntica** à captura pós-modularização. Não afirmar que esta é idêntica à prévia anterior à PR #58 (a captura antiga possui altura diferente); o deploy na 9446 permanece nessa prévia antiga.
6. CI do HEAD deve finalizar verde antes de liberar integração. Não fazer merge em `main` ou deploy nesta PR.

## Próximas metas após revisão

- Refatorar a camada de consultas usando hooks/testes de concorrência e cancelamento **se houver necessidade real**; não inventar endpoints ou regras.
- Evoluir primeiro as funcionalidades previstas da plataforma em especificações/contratos backend, depois UI modular. Sem painéis de CRM, Inbox ou Staff no Manager.
- Integrar PR #58 antes desta branch para garantir uma única base de componentes e evitar duplicação em novos módulos.
