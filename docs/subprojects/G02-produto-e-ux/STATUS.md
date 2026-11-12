# G02 — Produto e UX | STATUS

> **AUDITORIA TÉCNICA PARCIAL (produto/UX e fonte estática) — 12/11/2026.** Checkout `origin/main` SHA `36b7ebeabee236196e71b2f43f2ee92a4e0b49c9`, DevServer01/worktree isolada. Revisão dos PRDs, ADRs, fonte de React e contratos documentados. Não foram executados browser autenticado, testes de tenant real, deploy, alteração de banco ou aceite do produto.

## Estado multidimensional

| Dimensão | Estado | Evidência e limite |
|---|---|---|
| **Documentação G02** | **Auditoria parcial** | Capítulos 00–07 reconciliados; aprovação da matriz de produto/UX pelo responsável pendente |
| **Implementação da G02** | **Não aplicável (governança)** | `docs/product` é fonte de documentação; não package, API ou tabela operacional |
| **Código de interfaces de outros owners** | **Arquivos encontrados no checkout** | `apps/workspace-web/src/features`, `apps/master-admin-web/src`, `apps/support-web/src`, `packages/front-shared`; não prova deployment |
| **Integração** | **Não verificada na G02** | Faltam evidências de jornadas E2E reais por perfis Keycloak/OpenFGA e tenant |
| **Operação** | **Não aplicável à G02 como serviço** | Deploy e módulos/ambientes devem ser auditados por A01–A03, P01–P06 e Infra |
| **Product Gates** | **Não promovidos** | Escopo PRD-003A aprovado; CRM/Inbox e módulos posteriores dependem dos respectivos gates |

## Fontes verificadas

| Referência | Estado de produto registrado | Limite da evidência |
|---|---|---|
| `docs/product/MVP-SCOPE.md`, `MODULE-ORDER.md` | Basic e sequência comercial de CRM até launch | Escopo/ordem **não são comprovação de entrega** |
| `PRD-003A-GESTAO-ATENDIMENTOS-MVP.md` | **Recorte Basic aprovado em 11/11**, entre WhatsApp e Scheduling | SM-01–06 e Product Gate ainda devem ser verificados |
| `PRD-FUNNELS-AND-TEMPLATES-PROPOSAL.md` | Construtor avançado F0–F8 **pós-MVP/congelado** | Não autoriza incluir UI/engine avançada |
| `CORE-CRM-MVP-ACCEPTANCE.md`, `CORE-CRM-FRONTEND-COMPLETION.md` | Backend/frontend e testes locais descritos; CRM **incompleto** como produto | Browser com identidades/perfis reais, usabilidade, backup/restore e Product Gate |
| `PRD-002-INBOX-ACCEPTANCE.md`, `INBOX-FRONTEND-PROGRESS.md` | Inbox em desenvolvimento; SSE descrito posteriormente ao polling inicial | E2E de SSE/isolamento/identidade, rollout e Product Gate |
| `PRD-SYNDES-SUPPORT.md` | Support interno/externo da fornecedora com fronteira própria | Não confundir com P05 nem presumir deploy |
| `ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md` | Contextos Workspace/Manager/Support separados; `front-shared` visual | Não prova separação de sessões/permissões implantada |
| Código React em `apps/*/src` | Arquivos de CRM, Inbox, WhatsApp, Manager e Support presentes | Presença de fonte sem teste nesta revisão |

## Divergências, riscos e bloqueios

1. **Baseline comercial versus incrementos iniciais:** Scheduling/IA/Documents/Email/Billing/Site estão no escopo futuro do MVP; não são automaticamente funcionalidades ativas.
2. **CRM/Inbox:** checklists de implementação/UX não equivalem a aceite real. Exigir testes com JWT/Keycloak, OpenFGA e dados isolados por tenant; frontend mockado não basta.
3. **SSE da Inbox:** documento anterior indica polling; checkpoint posterior descreve SSE com testes locais, sem E2E e homologação operacional.
4. **Atendimento Basic versus F0–F8:** somente PRD-003A está aprovado; engine e editor avançado ficam congelados.
5. **Manager versus Workspace:** públicos, autenticação e API distintos; papel global não libera dados privados.
6. **Taxonomia:** Platform Organization ≠ CRM Organization; Case do Syndes Support ≠ Protocol do Atendimento Basic.
7. **Qualidade transversal:** acessibilidade, concorrência, recovery e experiência multicontexto ainda não foram verificadas na auditoria G02.

## Entrega desta atualização documental

- [Escopo](ESCOPO.md): missão, atores, histórias, casos de uso, requisitos, limites Basic e matriz de produtos/UX.
- [Referência](REFERENCIA-TECNICA.md): fontes de interfaces e responsabilidades, sem atribuir código a G02.
- [Plano documental](../../blueprint/PLANO-ATUALIZACAO-MODULOS.md): G02 passa de baseline a auditoria parcial. Nenhum STATUS operacional de produto é promovido.
- **Sem alteração de código de produto, PRDs canônicos, CI geral, banco de dados ou infraestrutura.**

## Próximas verificações

1. **Revisão pelo responsável de Produto:** validar a matriz de escopo, os aceites pendentes e o que foi classificado como proposta/documento histórico.
2. **G03 — Engenharia e colaboração:** próxima unidade da auditoria documental; revisar rastreabilidade, AGENTS, Git/CI e limite dos agentes.
3. **Owners P01/P02/P03/P05:** conferir produto versus código e Product Gates com testes reais; reconciliação de status técnico em suas ondas.

## Checkpoint

| Data | SHA/ambiente | Evidência | Não comprovado |
|---|---|---|---|
| 2026-11-12 | `36b7ebeabee236196e71b2f43f2ee92a4e0b49c9` · DevServer01, worktree isolada | PRDs, ADRs e fonte React revisados | Homologação, deploy, segurança E2E, aceitação comercial |

**Critério para sair de auditoria parcial:** revisão formal da matriz pelo responsável, conciliação de versões dos PRDs e evidências dos owners em seus Product Gates. Publicar documentação não conclui MVP.
