---
title: "P03 · Operação e implantação"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Operação e implantação

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 2026-11-12.** Evidência: worktree `b452a03e`; testes locais sem implantação. NÃO equivale a CI da SHA publicada, integração real, deploy ou Product Gate.

> L24: - WA-CUT07–10: migration 008 em staging, todas instâncias legadas compatíveis com filtro, canário e rollback — não ativar projetores concorrentes.

> L42: A versão anterior deste STATUS era apenas um esqueleto documental sem auditoria funcional. Ela foi substituída pela inspeção parcial de código, testes e bloqueios acima, sem presumir operação homologada.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/REFERENCIA-TECNICA.md)

> L3: > **INVENTÁRIO DOCUMENTAL NÃO AUDITADO.** Só descreve arquivos/declarações presentes no repositório; não representa funcionalidade implantada.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/OPERACAO.md)

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

> L43: **Regra de operação:** o corte do projetor, service grants, restore e deploy exigem gates próprios; esta alteração documental não habilita workers ou conexões.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L52: **Regra crítica:** nunca permitir dois projetores proprietários do mesmo evento nem mudar `projection_path` histórico para simular rollback. O caminho `events` não está habilitado no runtime por esta documentação. Fontes: `docs/engineering/WBS-WHATSAPP-PROJECTION-CUTOVER-20261111.md` e `apps/core-host/src/platform-event-worker-composition.ts`.

> L58: A [Referência técnica de P03](../REFERENCIA-TECNICA.md) e a [Operação de P03](../OPERACAO.md) centralizam a leitura. A antiga unidade I09 continua disponível apenas para consultar histórico, WBS e trabalho operacional anterior.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/06-wbs-marcos-e-aceite.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
