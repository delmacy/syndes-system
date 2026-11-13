---
title: "Q07 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)

> L9: \| **Documentação** \| **Auditoria parcial:** capítulos 00–07, contratos, fluxos, matrizes e WBS reconciliados; aprovação técnica do responsável pendente \|

> L33: 5. **Segurança:** nenhum tenant operacional, migrations de produção, grant, porta pública ou secret foi alterado nesta frente.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/REFERENCIA-TECNICA.md)

> L9: - **Automação separada:** `syndes-docs-pages.yml` publica Docs, `syndes-docs-project-sync.yml` sincroniza Issues/Projects quando autorizado, sem duplicar regressão PR.

> L15: \| Declaração \| Arquivo \| Contrato verificado \|

> L32: **Q07 não publica API HTTP, eventos do domínio nem banco operacional.** Seu contrato público para GitHub Actions é a matriz JSON `{"include":[{"suite":"...", "node":"..."}]}`, os exit codes, logs de jobs e o `Syndes CI Gate`. Não modificar contratos públicos de P01/P02/P03/P05 para corrigir seleção.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/OPERACAO.md)

> L16: - [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/04-contratos-e-dependencias-publicas.md)

> L5: **Q07 não mantém API HTTP, schema PostgreSQL, controller, port NestJS nem eventos de negócio**. Seus contratos executáveis são **comandos, JSON de planejamento, YAML de CI e exit codes**, consumidos pelo GitHub Actions.

> L7: \| Interface \| Entrada \| Saída / efeito \| Contrato de falha \|

> L27: \| Kernel/Organizations/Host/Infra/CI \| Todas as suites disponíveis \| Efeito amplo sobre segurança, tenancy, contratos e runtime \|

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
