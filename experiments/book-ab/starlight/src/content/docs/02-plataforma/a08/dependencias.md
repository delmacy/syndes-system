---
title: "A08 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A08-core-kernel/STATUS.md)

> L18: - A INVENTARIAR com contratos públicos, distinguindo dependências obrigatórias e opcionais.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A08-core-kernel/REFERENCIA-TECNICA.md)

> L3: > **PILOTO DE INVENTÁRIO · 12/11/2026.** Código verificado, testes locais registrados em P14; integração/ativação não derivadas desta página. Os métodos listados são entradas **exportadas**, não o catálogo de todos os métodos privados.

> L8: - **Tecnologia:** TypeScript 5.9 / Node 22+, compilado por `tsc`, sem dependências diretas de NestJS, SQL ou OpenFGA (`packages/core-kernel/package.json`).

> L19: \| `ModuleRegistry` — `src/module-registry.ts` \| `register(module)` \| Valida ID, versão, schema, dependências e duplicações \|

> L21: \| `ModuleRegistry` \| `ordered()` \| Ordena por dependências e rejeita ausência/ciclo \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A08-core-kernel/OPERACAO.md)

> L9: - [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A08-core-kernel/chapters/04-contratos-e-dependencias-publicas.md)

> L3: - Dependências obrigatórias e opcionais: A VERIFICAR.

> L4: - Bibliotecas permitidas: consultar exports públicos e dependências existentes, sem copiar implementação privada.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A08-core-kernel/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A08-core-kernel/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
