# Syndes System

Codinome interno do produto SaaS atualmente em desenvolvimento.

## Estado

- MVP scope: **FROZEN**
- Fase funcional atual: **PRD-002 Inbox** (priorização explícita de 2026-11-01; **Core CRM permanece incompleto, especialmente no frontend**)
- Estratégia: **um módulo funcional por vez**
- Arquitetura de negócio: **monólito modular**, salvo separação comprovadamente necessária
- Regra de escopo: toda nova ideia é classificada como `BLOCKER`, `BUG`, `MVP` ou `POST-MVP`

## Ordem funcional aprovada

1. Core CRM
2. Inbox
3. WhatsApp
4. Scheduling
5. AI First-Level Assistant
6. Documents
7. Email
8. Onboarding
9. Subscription & Billing
10. Commercial Website
11. Release Candidate
12. Launch

Instagram, Google Calendar, Automation Platform, AI Advanced, ERP, estoque, financeiro empresarial, múltiplos números e demais expansões permanecem fora do MVP.

## Organização atual

O repositório contém o Core Host modular, os pacotes aprovados (incluindo CRM e Inbox), infraestrutura reprodutível e o Workspace React para tenants. A implantação atual no DevServer01 é de desenvolvimento, **não de produção**.

- `AGENTS.md`: regras globais para agentes e contribuidores
- `modules/*/AGENTS.md`: contrato de trabalho de cada módulo
- `docs/product/`: baseline de produto
- `docs/engineering/`: práticas de engenharia e testes
- `tests/`: estratégia e harnesses de integridade, segurança e performance
- `.github/workflows/`: gates automatizados de CI

Leia o `AGENTS.md` raiz antes de alterar qualquer parte do repositório.


## Workspace dos tenants — entrega em desenvolvimento

- `apps/workspace-web/`: Shell React/TypeScript + Tailwind CSS + shadcn/ui com dashboard, CRM, Inbox e configurações.
- **Um único login Keycloak** (OIDC com PKCE S256); a janela HTTP Basic foi removida do Workspace. O Core Host segue protegendo todas as APIs com token e autorização server-side OpenFGA.
- Ingress de desenvolvimento via Tailscale Serve/Traefik; Nginx interno apenas serve os arquivos estáticos.
- PR #9 (`feat/workspace-shell-v1`, **draft**) depende da base `feat/core-inbox-foundation`/PR #8. **Nenhum merge ou release de produção foi declarado.**
- Registro das stacks Komodo propositalmente adiado, sem bloquear a evolução funcional do MVP.

**Documentação de continuidade:**

- [Arquitetura do Workspace e decisões de autenticação](docs/engineering/WORKSPACE-SHELL-ARCHITECTURE.md)
- [Runbook DevServer01: verificação, publicação e rollback](docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md)
- [Handoff do Workspace e gate para o próximo módulo](docs/product/WORKSPACE-MVP-HANDOFF.md)
- [README da aplicação Workspace](apps/workspace-web/README.md)

**Próxima fase funcional:** Inbox (PRD-002), autorizada pelo responsável pelo produto com pendências abertas no frontend CRM. Ambos exigirão aceite antes de lançamento.

- [Progresso da Inbox no Workspace e pendências de aceite](docs/product/INBOX-FRONTEND-PROGRESS.md)
