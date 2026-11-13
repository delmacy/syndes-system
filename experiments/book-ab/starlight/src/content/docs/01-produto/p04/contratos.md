---
title: "P04 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/STATUS.md)

> L10: - Revisar escopo e contratos do próprio módulo; aprovar primeiro incremento.

> L18: - A INVENTARIAR com contratos públicos, distinguindo dependências obrigatórias e opcionais.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/REFERENCIA-TECNICA.md)

> L9: - **Imports públicos:** `@syndes/core-organizations` e `./plugin` por `package.json#exports`.

> L22: **Aviso:** o `WorkforceService` está no pacote, mas o comentário de código diz que **não há controller HTTP público até Product Gate**. Um método TS não significa API HTTP ou UI habilitada.

> L29: - Contrato de staff e team ainda requer formalização de capacidade estável e testes de segurança.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/OPERACAO.md)

> L16: - [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/chapters/04-contratos-e-dependencias-publicas.md)

> L4: - Bibliotecas permitidas: consultar exports públicos e dependências existentes, sem copiar implementação privada.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
