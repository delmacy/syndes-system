# Syndes Workspace — arquitetura do Shell e limites de segurança

**Estado:** implementado e testado em ambiente de desenvolvimento (DevServer01), **não homologado para produção**. Atualizado em 2026-11-01.

## Decisão de arquitetura (ADR — vigente no MVP)

A Syndes adotará três **experiências frontend distintas**, mas não três sistemas de autorização independentes:

| Aplicação | Público | Estado | Segurança |
| --- | --- | --- | --- |
| **Syndes Workspace** | Empresas (tenants) e seus funcionários | Shell React implementado; CRM e Inbox conectados | OIDC Keycloak, autorização OpenFGA no Core Host; banco por tenant |
| **Syndes Admin Master** | Operadores da plataforma | Planejado; **não implementado** | Ingress/API próprios, restrição de rede administrativa, cliente OIDC/audience próprios e autorização administrativa no servidor |
| **Syndes Customer Portal** | Clientes finais das empresas | Planejado; **não implementado** | Ingress/API e clientes OIDC apropriados ao público, escopos estritos por cliente/tenant |

A diferenciação por **porta ou subdomínio** ajuda a manter limites operacionais, mas **não substitui** autenticação, validação de token/audience, autorização por recurso e verificação de vínculo com o tenant no servidor. CORS e `Origin` não são controles suficientes: clientes HTTP podem ignorá-los ou falsificá-los. O Admin Master não deve ser publicado na mesma entrada ou rede pública do Workspace.

**Não há necessidade de três backends monolíticos:** o Core Host permanece modular, com portas/adapters e fronteiras de API explícitas. O isolamento de rede e de autorização é determinado pelos riscos e papéis de cada superfície.

## Frontend do Workspace

Diretório: `apps/workspace-web/`. Stack:

- React 19 + TypeScript; build estático com Vite 8.
- Tailwind CSS 4 + componentes shadcn/ui (arquivos versionados sob `src/components/ui/`); ícones Lucide.
- `src/App.tsx`: Shell de navegação, sidebar responsiva, estado da sessão, conteúdo, header e configuração ativa.
- `src/features/overview.tsx`: KPIs de Inbox e contatos CRM carregados de endpoints reais e de forma independente; `403` de um módulo não torna os demais invisíveis.
- `src/features/crm.tsx`: lista, busca e cadastro de pessoas e organizações, visualização de detalhes.
- `src/features/inbox.tsx`: lista/filtro de conversas, mensagens, status, atribuição, respostas, notas internas e entrada **simulada**. Ainda não há envio real por WhatsApp.
- `src/features/settings.tsx`: informações de identidade, tenant e segurança; administração de funcionários e políticas ainda não construída.
- `src/lib/api.ts`: cliente HTTP que recebe o tenant ativo, adiciona Bearer token e trata `401/403`; não possui rota Admin.
- `src/lib/auth.ts`: login Authorization Code com PKCE S256, validação de `state` e troca single-flight do código OIDC.

O Shell compõe **páginas e recursos por módulo**, sem introduzir um framework universal de plugins, mercado de componentes ou troca dinâmica de backend nesta fase. Os pacotes NestJS de CRM/Inbox são montados pelo Core Host conforme `docs/engineering/CORE-MODULE-MOUNTING.md`; a UI é uma aplicação consumidora, não eleva privilégios.

## Login único: decisão aplicada em 2026-11-01

Fluxo atual:

1. O usuário acessa o Workspace dentro da Tailnet. A interface inicial carrega como estático **sem credenciais HTTP Basic**.
2. Ao selecionar **Entrar**, o navegador é redirecionado ao Keycloak com cliente público `syndes-workspace-ui`, **Authorization Code + PKCE S256**.
3. O callback valida `state`, limite de vida e code verifier; obtém o access token e mantém-no **apenas em memória**.
4. O Workspace solicita CRM e Inbox em `/v1/tenants/:tenantId/{crm,inbox}/*` com `Authorization: Bearer ...`.
5. O Core Host verifica identidade, membership, políticas OpenFGA e banco do tenant **no servidor**, sem confiar apenas no `tenantId` do browser.

**HTTP Basic da prévia antiga foi removido somente do roteador Workspace**, evitando duas telas de login. A **prévia legada**, em sua configuração própria, pode continuar com HTTP Basic e não representa o novo fluxo. Não remover a validação JWT das APIs.

**Limites do logout atual:** o botão Sair limpa o token do estado React, não revoga o token emitido nem faz logout federado no Keycloak; atualizar a página exige autenticar o frontend novamente (o SSO pode reaproveitar sessão do provedor). Tratamento robusto de expiração/refresh e logout federado é pendência antes de produção.

## Topologia atual do ambiente de desenvolvimento

```text
Navegador dentro da Tailnet
      |
      | HTTPS :9443 (certificado verificado)
      v
Tailscale Serve -> localhost:80 -> Traefik (rede infra-proxy)
                                   |                     |
                         rota / e assets        rota /v1/*, /modules/*
                                   |                     |
                                   v                     v
                     Workspace static HTTP          Core Host NestJS
                      (Nginx de arquivos)            (API/controle)
                                                         |
                                              Keycloak + OpenFGA + OpenBao
                                                         |
                                               PostgreSQL por tenant
```

- Traefik é o **único gateway reverso** nessa topologia. O Nginx interno é somente um servidor leve para `index.html`, arquivos Vite e `workspace-runtime.json`; não faz ingress/TLS nem proxy de APIs.
- `syndes-tailnet-only@docker` usa uma **allowlist de origem da conexão local do proxy Tailscale**. Tal regra é específica deste servidor e **não deve ser copiada cegamente para uma rede pública**. A exposição real é limitada também pelas ACLs e pelo `Tailscale Serve`.
- O Core Host não expõe a porta HTTP da API na rede pública; seu mapeamento de desenvolvimento é loopback.
- O container Workspace usa filesystem read-only, UID não-root, capabilities removidas, configuração estática somente leitura e rede interna Docker.
- A UI pública estática não concede dados por si só. `401`/ `403` continuam exigidos pelo backend em todas as rotas protegidas.
- Um único tenant de demonstração é selecionado por configuração não secreta. **Ainda não existe seleção dinâmica segura de organizações**. Para produção, usar memberships e seleção autenticada conferidas no backend.

## Runtime não secreto e segredos

O JSON de runtime tem apenas `issuer`, `clientId`, `tenantId` (demonstração) e `tenantLabel`. Ele **não contém senhas, chaves, tokens ou shares de recuperação** e deve ser tratado como informação pública da aplicação. Exemplo versionado em `apps/workspace-web/workspace-runtime.example.json`.

O arquivo operacional `/srv/syndes-lab/workspace-runtime.json` **não pertence ao repositório**. O bind mount somente leitura entrega esse arquivo em `/etc/nginx/workspace-runtime.json`; o Nginx o serve via `alias` em `/workspace-runtime.json`. Ele não é copiado para `dist` (que Vite pode apagar). Código-fonte e manifests operacionais também não devem incluir segredos do OpenBao nem senhas do usuário de demonstração.

## Políticas de permissão e UI

- OpenFGA no Core Host é o **ponto de decisão efetivo**. Ocultar um botão não garante autorização.
- Composição de UI por capacidades deve evoluir para `can(action, resource)`, não `isAdmin` espalhado em componentes. Formulários podem oferecer vistas somente leitura ou ações de criar/editar quando autorizadas; o servidor sempre reverifica.
- A UI atual oferece ações e apresenta a resposta de `403`; consulta antecipada de capacidades para esconder ações específicas **ainda não foi implementada**.
- Não usar o token do tenant na API Admin. Admin Master terá ingress/cliente OIDC/audience e políticas separados.
- Falha de Keycloak, OpenFGA, banco de tenant ou OpenBao deve falhar fechada, não elevar permissões.

## Fora do escopo desta entrega

Admin Master, Customer Portal, onboarding multi-tenant, seleção dinâmica de empresa, editor de permissões, WhatsApp real, realtime, produção pública, mobile nativo, white-label e marketplace de componentes **não** foram entregues com o Shell.

Para operações e evidências, consulte `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md` e `docs/product/WORKSPACE-MVP-HANDOFF.md`.
