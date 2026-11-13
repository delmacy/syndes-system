---
title: "G02 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)

> L12: \| **Integração** \| **Não verificada na G02** \| Faltam evidências de jornadas E2E reais por perfis Keycloak/OpenFGA e tenant \|

> L32: 2. **CRM/Inbox:** checklists de implementação/UX não equivalem a aceite real. Exigir testes com JWT/Keycloak, OpenFGA e dados isolados por tenant; frontend mockado não basta.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/REFERENCIA-TECNICA.md)

> L38: Estados de carregamento/erro/negação e adaptação mobile precisam ser verificados por módulo e papel. Capturas/mock de frontend não comprovam autorização com Keycloak e OpenFGA reais.

> L46: - [STATUS](STATUS.md) distingue documentação, implementação, integração, operação e Product Gate.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/OPERACAO.md)

> L9: - [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/04-contratos-e-dependencias-publicas.md)

> L13: \| Dependências entre domínios \| Matriz de risco e ordem de entrega \| G01/A04 e owners dos contratos \|

> L32: - **CRM → Inbox → WhatsApp → Atendimento Basic** é a sequência de produto; a composição técnica tem dependências próprias. Não presumir ordem de inicialização ou evento apenas pela ordem comercial.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L23: \| CRM \| Listar/cadastrar/editar pessoas e organizações; relações, tags, notas e CSV \| `apps/workspace-web/src/features/crm.tsx`, `crm-person-detail.tsx`; [checkpoint](../../../product/CORE-CRM-FRONTEND-COMPLETION.md) \| Keycloak/OpenFGA de perfis distintos, acessibilidade e Product Gate \|

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
