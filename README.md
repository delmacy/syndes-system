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

Este repositório começa pela governança de produto e engenharia. O breakdown técnico do monólito ainda não foi congelado; portanto, a estrutura de código será criada somente no handoff técnico do PRD-001.

- `AGENTS.md`: regras globais para agentes e contribuidores
- `modules/*/AGENTS.md`: contrato de trabalho de cada módulo
- `docs/product/`: baseline de produto
- `docs/engineering/`: práticas de engenharia e testes
- `tests/`: estratégia e harnesses de integridade, segurança e performance
- `.github/workflows/`: gates automatizados de CI

Leia o `AGENTS.md` raiz antes de alterar qualquer parte do repositório.
