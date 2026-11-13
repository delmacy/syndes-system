---
title: "P03 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 2026-11-12.** Evidência: worktree `b452a03e`; testes locais sem implantação. NÃO equivale a CI da SHA publicada, integração real, deploy ou Product Gate.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/REFERENCIA-TECNICA.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/OPERACAO.md)

> L9: - [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/04-contratos-e-dependencias-publicas.md)

> L3: - Dependências obrigatórias e opcionais: A VERIFICAR.

> L4: - Bibliotecas permitidas: consultar exports públicos e dependências existentes, sem copiar implementação privada.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L56: O gateway Whatsmeow está **dentro do módulo P03 WhatsApp**. O plugin NestJS em `modules/whatsapp/src/plugin.ts` representa a integração do módulo com o Core Host; o processo Go em `modules/whatsapp/gateway/whatsmeow/` é um sidecar de protocolo, sessão e callbacks. A divisão de processos não implica dois módulos de negócio.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
