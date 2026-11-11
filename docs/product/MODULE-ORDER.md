# Module Delivery Order

A ordem funcional é fixa durante o MVP:

1. PRD-001 Core CRM
2. PRD-002 Inbox
3. PRD-003 WhatsApp
4. **PRD-003A Gestão de Atendimentos Básica**
5. PRD-004 Scheduling
6. PRD-005 AI First-Level Assistant
7. PRD-006 Documents
8. PRD-007 Email
9. PRD-008 Onboarding
10. PRD-009 Subscription & Billing
11. PRD-010 Commercial Website
12. Release Candidate
13. Launch

Cada módulo passa por:

Product Requirements → Business Rules → UX/Security → Technical Breakdown → Construction → Integration → Tests → Security Review → Usability Review → Documentation & Enclosure.

Não detalhar tecnicamente módulos posteriores enquanto o módulo corrente não tiver Product Gate suficiente para avançar.


## Priorização operacional (exceção registrada em 2026-11-01)

O responsável pelo produto determinou iniciar a implementação da **Inbox** mesmo com pendências abertas na **UI do Core CRM**. A sequência de lançamento e os critérios de conclusão permanecem válidos, mas as tarefas de CRM não bloqueiam o início da Inbox neste ciclo. Nenhum módulo é marcado DONE por ter somente backend/CI aprovado.

## Finalização das pendências do CRM (2026-11-01)

O responsável pelo produto autorizou explicitamente completar as tarefas antigas do Core CRM frontend em paralelo ao histórico de priorização da Inbox. Isso não altera o escopo nem aprova lançamento. A referência atual é `docs/product/CORE-CRM-FRONTEND-COMPLETION.md`: implementação, testes e riscos remanescentes de homologação Keycloak/OpenFGA e produção.

## Decisão adicional de escopo (2026-11-11)

Gestão de Atendimentos Básica entra no MVP após CRM/Inbox/WhatsApp e antes de Scheduling/IA. A frente técnica SM-01/02 foi autorizada para conciliação de baseline e backend de domínio, sem antecipar frontend, migrations operacionais ou Product Gate. Construtor F0–F8 completo permanece pós-MVP. Ver PRD-003A e WBS SM.
