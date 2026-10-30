# Syndes System

Codinome interno do produto SaaS atualmente em desenvolvimento.

## Estado

- MVP scope: **FROZEN**
- Fase atual: **PRD-003 WhatsApp** (CRM aceito; Inbox operacional no escopo Tailscale)
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

O Core CRM (PRD-001) foi aceito no Product Gate CRM-11; a entrega verificável está registrada em `docs/engineering/PRD-001-CORE-CRM-SPRINT-PLAN.md` e `docs/engineering/tasks/PRD-001/CRM-11-acceptance.md`. Inbox (PRD-002) está operacional no escopo Tailscale. WhatsApp (PRD-003) é o módulo corrente; sua spec e plano estão em `docs/product/PRD-003-WHATSAPP-SPEC.md` e `docs/engineering/PRD-003-WHATSAPP-SPRINT-PLAN.md`.

- `AGENTS.md`: regras globais para agentes e contribuidores
- `modules/*/AGENTS.md`: contrato de trabalho de cada módulo
- `docs/product/`: baseline de produto
- `docs/engineering/`: handoff técnico, estratégia de testes, sprints e ordens de trabalho
- `docs/engineering/tasks/PRD-001/`: tarefas detalhadas para execução/revisão do Core CRM
- `tests/`: estratégia e harnesses de integridade, segurança e performance
- `.github/workflows/`: gates automatizados de CI

Leia o `AGENTS.md` raiz antes de alterar qualquer parte do repositório.
