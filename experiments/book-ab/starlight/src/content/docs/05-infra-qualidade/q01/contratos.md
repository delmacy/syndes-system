---
title: "Q01 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/REFERENCIA-TECNICA.md)

> L11: - **Owners de produto:** `modules/*/test`, `apps/*/test` e suites próprias; Q01 não absorve seus contratos.

> L27: As assinaturas descritas vêm da leitura das fontes, não de um pacote Q01 exportável. Evitar copiar código de infra/módulos e apresentá-lo como biblioteca pública.

> L31: **Q01 não publica endpoints HTTP, contratos OpenAPI, eventos do Event Bus, classes de domínio, exports de package ou schemas/migrations próprios**. O contrato com o CI é **executar testes e emitir exit code/resultado**, correlacionados ao SHA, job, ambiente e negativa verificada. APIs e objetos SQL testados pertencem a suas unidades de runtime.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/OPERACAO.md)

> L16: - [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **Q01 não expõe endpoints HTTP, package exports, eventos de negócio, controllers, migrations nem classes de domínio.** Seus contratos observáveis são arquivos de teste, comandos, exit codes, fixtures e resultados dos jobs executados por Q07.

> L5: \| Contrato / interface \| Entrada \| Efeito observável \| Restrição \|

> L25: \| Provas de produto \| **Módulos** (`modules/*/test`, `apps/*/test`) \| Links para suite, não alterar seus contratos \|

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
