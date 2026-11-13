---
title: "A06 · Frontend e interfaces"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Frontend e interfaces

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/REFERENCIA-TECNICA.md)

> L7: Node ESM >=22, jose 6.0.11, pg 8.16.3. Serviço backend de delegação owner/admin, sem frontend, CRM, Inbox ou proxy genérico. C01 é owner do Control, C03 da identidade, C04 da autorização, C05 dos segredos.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [03-capabilities.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/03-capabilities.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L3: Fluxo: HTTP POST -> JWT RS256 -> OpenFGA can_write -> SQL Control SECURITY DEFINER -> resposta sanitizada. Persistência Control, não Tenant DB. Segredos via /run/secrets; rede loopback por padrão; frontend próprio inexistente. Nenhum evento de negócio publicado pela API HTTP foi identificado.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
