# Syndes System

Codinome interno do produto SaaS atualmente em desenvolvimento.

## Estado

- MVP scope: **FROZEN**
- Fase atual: **PRD-001 Core CRM**
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

O repositório começou pela governança de produto e engenharia. O handoff técnico do PRD-001 registra NestJS no backend, Next.js App Router no frontend separado e Drizzle ORM + `pg` para PostgreSQL. O primeiro slice iniciou o registro de tenants do Control Plane e o caminho de migrations descartáveis no CI. Ainda não há endpoints autenticados, provisionamento de tenant, comportamento do CRM ou frontend. As decisões restantes e o progresso verificável estão em `docs/engineering/PRD-001-CORE-CRM-TECH-HANDOFF.md`.

- `AGENTS.md`: regras globais para agentes e contribuidores
- `modules/*/AGENTS.md`: contrato de trabalho de cada módulo
- `docs/product/`: baseline de produto
- `docs/engineering/`: handoff técnico, estratégia de testes, sprints e ordens de trabalho
- `docs/engineering/tasks/PRD-001/`: tarefas detalhadas para execução/revisão do Core CRM
- `tests/`: estratégia e harnesses de integridade, segurança e performance
- `.github/workflows/`: gates automatizados de CI

Leia o `AGENTS.md` raiz antes de alterar qualquer parte do repositório.
