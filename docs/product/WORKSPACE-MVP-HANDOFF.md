# Handoff do Workspace — continuidade do MVP

**Data:** 2026-11-01
**Classificação:** integração transversal de UI do MVP; **não é um novo módulo comercial**.
**Status:** desenvolvimento demonstrável no tenant de laboratório; PR #9 em revisão; não é release de produção.

## O que foi entregue e o que foi provado

| Critério | Estado | Evidência |
| --- | --- | --- |
| Application Shell React/shadcn/ui | **Implementado** | `apps/workspace-web/src/App.tsx` e componentes `src/components/ui/` |
| Dashboard / CRM / Inbox no mesmo Shell | **Integrado** | `src/features/overview.tsx`, `crm.tsx`, `inbox.tsx`; acesso real ao Core Host |
| Login único Keycloak | **Testado** | HTTP `200` em `/` sem `WWW-Authenticate`; login PKCE em Chrome |
| Sessão local em memória | **Implementado** | `src/lib/auth.ts`; logout local não faz logout federado |
| Tenant isolation de API | **Testado no tenant demo** | Requisições sem token `401`, outro tenant `403`, testes de API; **não substitui teste multi-tenant de produção** |
| API Admin isolada | **Decisão arquitetural** | Admin Master ainda não existe; não há API Admin exposta pelo Shell |
| Configuração pós-build | **Corrigida** | `workspace-runtime.json` independente de `dist` |
| CI frontend | **Aprovada** | workflow `.github/workflows/workspace-web.yml`; testes unitários e build |
| Browser E2E de login | **Aprovado no DevServer01** | `tests/browser-smoke.mjs` (Chrome + Keycloak real) |
| Acessibilidade/UX com vários papéis | **Pendente** | Não há aceite de múltiplos papéis nem testes completos de teclado/leitor de tela |
| Deploy de produção/backup/restore | **Não realizado** | Lab e CI não são homologação de produção |

## Decisões estabilizadas

1. A Syndes terá experiências independentes: Workspace de funcionários dos tenants, Admin Master da plataforma e Customer Portal. **Somente Workspace foi implementado nesta etapa.**
2. Traefik faz ingress; Tailscale Serve expõe o ambiente privado; Nginx é servidor interno de estáticos. Nenhum segundo gateway web foi introduzido.
3. Um login de usuário: Keycloak OIDC Authorization Code com PKCE S256. **HTTP Basic não protege mais o novo Workspace.** O Core Host continua autenticando e autorizando todas as APIs.
4. OpenFGA continua sendo autorização **server-side**. Futuro `can(action, resource)` controla visibilidade e estado das ações na interface, mas **nunca** substitui o backend.
5. O browser usa apenas o tenant demo configurado no runtime; o próximo onboarding real deve validar memberships no backend. Não implementar troca de tenant apenas alterando um dropdown/UUID no cliente.
6. Código de UI modular em `src/features/`; não criar um framework genérico de plugins antes de haver requisito comprovado.
7. **As stacks Komodo ficam para depois**, a pedido do usuário; não reabrir trabalho de infraestrutura se não bloquear o próximo módulo.
8. Respeitar o baseline aprovado em `docs/product/MVP-SCOPE.md` e a sequência em `docs/product/MODULE-ORDER.md`.

## Versões, código e dependências

- Workspace source: `apps/workspace-web` na branch `feat/workspace-shell-v1`.
- PR #9 (`https://github.com/delmacy/syndes-system/pull/9`) **draft**, tendo `feat/core-inbox-foundation` (PR #8) como base. **Não declarar merge nem produção.**
- Código do Host/API que atende CRM/Inbox já existe, porém não confundir `implemented` com `accepted`.
- O frontend não lê diretamente PostgreSQL/OpenBao; só APIs aprovadas do Host.
- Nenhum segredo, password, token ou recovery share deve ser versionado.

## Próxima etapa funcional

**Atualização da decisão (2026-11-01):** o responsável pelo produto esclareceu que o **Core CRM não está concluído, principalmente no frontend**, mas autorizou avançar para a **Inbox (PRD-002)**. Esta decisão muda a *prioridade de trabalho*, não atribui o status DONE ao CRM nem revoga seus critérios de aceite. O próximo foco de produto é a Inbox, aproveitando o Shell compartilhado. Ver `docs/product/INBOX-FRONTEND-PROGRESS.md` e `docs/product/PRD-002-INBOX-ACCEPTANCE.md`.

As pendências de UX, formulários, permissões por ação e relacionamentos do CRM continuam abertas. Antes do lançamento, todos os gates funcionais de CRM e Inbox deverão ser retomados e validados; não usar o aceite de backend como sinônimo de módulo entregue.

Para iniciar nova conversa/agente, usar o contexto:

> Trabalhamos no repositório `delmacy/syndes-system`, DevServer01, branch `feat/workspace-shell-v1`, PR #9 draft sobre a branch base `feat/core-inbox-foundation`/PR #8. O Workspace shadcn/ui está demonstrável em Tailnet, com login único Keycloak e autorização no Core Host. Primeiro revisar `AGENTS.md`, `docs/product/CORE-CRM-MVP-ACCEPTANCE.md`, `docs/product/WORKSPACE-MVP-HANDOFF.md`, `docs/engineering/WORKSPACE-SHELL-ARCHITECTURE.md` e `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md`. Não reabrir Komodo ou novas aplicações frontend sem necessidade. Não divulgar segredos nem dizer que o MVP está em produção. Verificar o gate do Core CRM e seguir a sequência de módulos aprovada.

## Pendências já catalogadas

- Gate funcional e testes de aceite do Core CRM; menus/formulários com capacidades por ação e não apenas tratamento reativo de `403`.
- Tenant context dinamicamente validado no backend, multi-tenant real, convites/gestão de usuários e segurança de múltiplos papéis.
- UX de login/logout federado, refresh/expiração de sessão e branding da tela Keycloak (antes de clientes externos).
- WhatsApp real, realtime e demais módulos seguem a ordem e escopo formal.
- Pipeline de entrega imutável + atualização atômica do frontend; configuração operacional em IaC versionado e sem segredos.
- Backups externos e restore comprovado, segurança e observabilidade de produção, ensaios de carga.
- Status externo Vercel reportou `failure` enquanto o CI principal do Workspace reportou sucesso; só integrar Vercel se ele passar a ser alvo oficial.
- Registro das stacks no Komodo adiado intencionalmente.

Este documento é um **checkpoint de continuidade**. Não é declaração de conclusão do MVP nem autorização de implantação em produção.
