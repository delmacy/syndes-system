# Syndes Workspace — frontend tenant (MVP)

Interface operacional do tenant, construída com **React 19, TypeScript, Vite 8, Tailwind CSS 4 e shadcn/ui**. Esta aplicação é diferente do futuro **Admin Master** (rede/API administrativa restrita) e do **Customer Portal** (clientes das empresas).

## Funcionalidades existentes

- Application Shell responsivo, sidebar colapsável, navegação, configurações e indicadores.
- CRM: consulta/pesquisa de pessoas e organizações; cadastro; visualização de detalhes.
- Inbox: fila por responsável (Minhas/Não atribuídas/Todas) e status com filtros combináveis no backend, histórico, abertura, atribuição/liberação, resposta/nota/simulação e handoff humano/bot. Painel contextual CRM com pessoa, notas e timeline, em terceira coluna no desktop ou painel lateral mobile. HTTP polling de 10 segundos (**ainda não é realtime push**).
- OIDC Keycloak Authorization Code **PKCE S256**, cliente público separado `syndes-workspace-ui`.
- API `/v1/tenants/:tenantId/crm/*` e `/v1/tenants/:tenantId/inbox/*`, autenticadas com Bearer.
- O Core Host valida autenticação/autorização com Keycloak/OpenFGA e resolve o banco do tenant do lado do servidor.
- Consultas do dashboard independentes: falta de permissão em um módulo não esconde os demais.
- Componentes de UI instalados pelo gerador oficial do shadcn/ui em `src/components/ui`.

## Estrutura

```text
src/
  App.tsx             Shell, layout e controle da sessão
  features/
    overview.tsx      Indicadores reais
    crm.tsx           Experiência CRM
    inbox.tsx         Experiência Inbox
    settings.tsx      Identidade e informações do tenant
  lib/
    auth.ts           PKCE e processamento do callback OIDC
    api.ts            Client HTTP limitado ao tenant
    views.ts          Tipos de navegação
  components/ui/      Componentes shadcn/ui
tests/
  api.test.mjs        Testes unitários de fronteira HTTP (sem credenciais)
  browser-smoke.mjs   Teste em Chrome do fluxo OIDC e das telas
```

## Desenvolvimento e validação

```bash
cd apps/workspace-web
npm ci
npm run build
npm test
npm run lint
npm run test:inbox-ui     # Playwright mockado sem segredos ou gravação real
```

Para o smoke no navegador, configure a variável `SYNDES_PREVIEW_PASSWORD` **somente na sessão local autorizada** e execute `npm run test:smoke`. O teste exige que o servidor da Tailnet esteja acessível e usa a instalação local de Chrome. **Não coloque senhas no repositório ou em logs.**

## Publicação no DevServer01

- Portal: `https://delmacy-desktoppc.tayra-delta.ts.net:9443/` (Tailnet; **Keycloak é a única autenticação de usuário**).
- Tailscale Serve HTTPS encaminha para o Traefik na porta 80 de loopback.
- Traefik termina o roteamento interno e envia `/` ao frontend estático e `/v1/*` ao Core Host. Backend exige JWT e não usa Basic Auth.
- Um Nginx mínimo *dentro* do container serve apenas arquivos compilados e o JSON de configuração, **não é um segundo proxy reverso**.
- `/srv/syndes-lab/workspace-runtime.json` contém issuer/clientId/tenantId/label **não secretos**, montado somente-leitura em `/etc/nginx/workspace-runtime.json`; o Nginx atende `/workspace-runtime.json` por `alias`, independente do diretório `dist`. Não colocar tenant data ou segredos no bundle.
- Os manifests privados de desenvolvimento estão em `/srv/syndes-lab/workspace.compose.yaml`, `workspace.traefik.yaml` e `workspace.nginx.conf`.

**Importante:** atualmente o tenant selecionado é o único tenant de demonstração vindo do arquivo de runtime. O Workspace **ainda não tem seletor de múltiplas organizações nem onboarding de tenant autenticado**; para clientes reais, a resolução de organização deverá usar membership verificada no backend. O valor de tenantId no cliente **não autoriza** acesso. Keycloak/OIDC é compartilhado, mas cada chamada exige autorização no backend.

Tokens vivem apenas em memória, sem `localStorage`. Atualizar a página exige novo login (com SSO do Keycloak quando aplicável). `Sair` limpa a sessão local, não encerra todas as sessões SSO do provedor.

## Segurança e limites

- **Nunca** expor endpoints Admin Master sob o domínio/ingress do tenant.
- Não confundir permissões de UI com acesso: todos os endpoints são protegidos por OpenFGA no servidor.
- O Admin Master e o Customer Portal terão aplicações, OIDC clients, e gateways separados, em suas próprias fases.
- Este MVP não inclui envio real por WhatsApp nem comunicação em tempo real; a Inbox atual usa backend persistente e canal de simulação.
- O ambiente foi validado em Chrome headless e via testes HTTP; testes de carga, backup/restore e deploy de produção ainda são necessários.


## Documentação de arquitetura e continuidade

- [Arquitetura, autenticação e limites de acesso](../../docs/engineering/WORKSPACE-SHELL-ARCHITECTURE.md)
- [Runbook do DevServer01 (login único, smoke e rollback)](../../docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md)
- [Handoff e próximos gates do MVP](../../docs/product/WORKSPACE-MVP-HANDOFF.md)

O `README` desta aplicação descreve o estado atual do código. O deploy de desenvolvimento usa também manifests operacionais **não versionados** em `/srv/syndes-lab`; não confundir exemplos de configuração pública com credenciais.


## Pendências de Inbox

A interface desabilita a resposta conforme status, humano/bot e atribuição, mas **não substitui a autorização do backend**. Ainda faltam realtime push seguro, anexos, testes reais de login/ações com vários atendentes e Product Gate. O CRM, especialmente sua UI, **também permanece incompleto**.


## Contexto CRM e filas da Inbox

``src/features/inbox-context.tsx`` exibe somente os dados obtidos das APIs CRM autorizadas. Não é uma cópia dos registros do tenant nem tenta buscar dados de outro tenant. A lista de conversas passa ``queue=mine|unassigned|all`` no backend; ``mine`` resolve o atendente a partir da identidade validada. O limite atual é de 100 conversas **por fila/status**, sem paginação. Empresas, tags, deep-link para contato específico e buscas com paginação ficam pendentes.


## Editor da Inbox e ficha de contato

A ficha contextual apresenta organizações e tags da pessoa vinculada por endpoints CRM com autorização independente no backend. A resposta, a nota interna e a entrada simulada têm rascunhos **por conversa e modo** em memória React. `Ctrl+Enter` / `Cmd+Enter` envia, e uma falha de rede mantém o rascunho para nova tentativa. Os rascunhos não são persistidos e desaparecem ao recarregar ou finalizar a sessão.

## Core CRM — experiência completa de registros (em desenvolvimento)

``src/features/crm.tsx`` gerencia lista, busca, paginação, criação/edição, arquivamento, confirmação de duplicados e importação/exportação CSV. ``src/features/crm-person-detail.tsx`` apresenta ficha de contato com empresas, tags, notas, canais, funcionário e timeline. A interface consulta ``GET /crm/capabilities`` e usa ``can(resource.action)``, sem flags de papel ``isAdmin``. O Core Host segue verificando JWT, membership e OpenFGA em **cada operação**.

Testes de browser sem segredo: ``npm run test:crm-ui`` (API/identidade simuladas). Para escopo, limites e critérios de aceite reais, leia [checkpoint CRM](../../docs/product/CORE-CRM-FRONTEND-COMPLETION.md).
