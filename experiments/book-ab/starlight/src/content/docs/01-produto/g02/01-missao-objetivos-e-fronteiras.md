---
title: "G02 · Missão e fronteiras"
description: "Volume Produto e módulos de negócio · capítulo G02 · matéria 01"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/01-missao-objetivos-e-fronteiras.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 1. Missão, objetivos e fronteiras

### Missão e valor

**G02 — Produto e UX** consolida decisões de produto, recortes de MVP, experiências esperadas, atores, requisitos, critérios de aceite e gates de evolução do Syndes. Serve ao responsável pelo produto, analistas, designers, engenheiros, segurança e QA como **índice de decisões verificáveis**, sem substituir os PRDs e contratos de cada módulo.

| Dentro da responsabilidade da G02 | Fora da responsabilidade da G02 |
|---|---|
| Manter visão de escopo comercial e a ordem funcional do MVP | Declarar um módulo implantado só porque consta do MVP |
| Distinguir requisito aprovado, proposta, execução e gate | Criar novos PRDs/funcionalidades sem decisão do produto |
| Relacionar atores, histórias, casos de uso, fluxos e UX | Ser dona de código, método, endpoint ou esquema SQL de P01/P02/P03 |
| Explicitar jornada e restrições de Tenant/Manager/Support | Misturar sessões, dados privados ou privilégios de ambientes distintos |
| Definir critérios de experiência e revisão com evidências | Converter mock, screenshot, CI local ou demo em homologação do produto |
| Registrar exclusões e bloqueios de decisão | Reativar construtor avançado F0–F8 ou múltiplos números sem Product Gate |

### Fronteiras funcionais confirmadas nos documentos

- **Cliente/Workspace:** interface de CRM, Inbox, WhatsApp e capacidades autorizadas por contexto de Account/Organization/Workspace. Os módulos de domínio continuam donos de suas regras, API e persistência. [ADR de composição](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md).
- **Gestão de Atendimentos Básica:** protocolo, etapas, atribuição e histórico **separados** da conversa contínua da Inbox e da pessoa do CRM. Escopo aprovado para MVP em [PRD-003A](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md); aprovação de escopo não equivale a aceite de produto.
- **Platform Manager:** administração global de metadados em frontend/API separados; não é uma aba privilegiada do Workspace e não acessa automaticamente conversas de tenants.
- **Syndes Support:** operação de atendimento da fornecedora para externos/internos. [PRD-SYNDES-SUPPORT](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-SYNDES-SUPPORT.md) não o transforma em motor de atendimento de todos os clientes.

### Estado das decisões de produto

**Baseline do MVP:** [MVP-SCOPE.md](https://github.com/delmacy/syndes-system/blob/main/docs/product/MVP-SCOPE.md). **Sequência de implementação:** [MODULE-ORDER.md](https://github.com/delmacy/syndes-system/blob/main/docs/product/MODULE-ORDER.md), com exceção registrada para avançar Inbox enquanto a UI CRM ainda tinha pendências. CRM e Inbox não devem ser marcados DONE sem Product Gate.

**Decisão de 11/11/2026:** Gestão de Atendimentos **Basic** foi incluída após CRM/Inbox/WhatsApp e antes de Scheduling; o construtor F0–F8 continua pós-MVP/congelado. Múltiplos números de WhatsApp, CRM avançado, marketplace, IA multiagente e ERP não foram incorporados ao Basic.

**G02 é unidade documental** de governança, não um produto faturável e nem um servidor. A homologação final depende de integração segura, UX utilizável, testes reais, recuperação e cliente externo pagante conforme a baseline comercial.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/01-missao-objetivos-e-fronteiras.md).
