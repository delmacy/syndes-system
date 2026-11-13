---
title: "I04 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)

> L27: 4. **P1 — Teste de isolamento incompleto.** `CONNECT` e grants básicos estão restritivos no banco examinado, mas falta matriz SQL completa e teste API/authorization A/B contra providers reais.

> L39: \| **55.03** \| Installer, canonicidade e schema/gates \| API opt-in/PG17 sintético; Control/restore/FGA reais BLOQ \|

> L47: \| Momento \| Ambiente/SHA \| Evidência \| Não auditado \|

> L50: \| 13/11/2026 \| CI GitHub da baseline `1395597` \| [24/24 success](https://github.com/delmacy/syndes-system/actions/runs/43355545663) \| Deploy real, staging, produção e Product Gate \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/REFERENCIA-TECNICA.md)

> L18: \| Event Bus \| `apps/core-host/sql/001_platform_events.sql`, `002_event_type_version_consistency.sql`, Control `control-module-events.schema` \| Schemas/objetos planejados por banco distintos; workers opt-in sob gates \|

> L51: \| `main() --apply` \| C01/C02 \| **Mutação não autorizada nesta passagem:** transação, advisory lock, SHA e evidência de backup/restore obrigatórios \|

> L53: \| `support-migration-gate.sh` \| P06/C02 \| Garante tenant operacional aprovado para migrations Support \|

> L74: - A outbox de tenant usa `platform_events` e depende do instalador/worker sob gates próprios.

> L82: - **CI baseline:** [GitHub Actions 43355545663](https://github.com/delmacy/syndes-system/actions/runs/43355545663), 24/24 `success` no SHA `1395597`. Testes de integração/restore descartáveis **não** provam aplicação das migrations no DevServer01.

> L85: - **WBS histórica:** 10.02 (PEND), 10.07/40.02/40.08/60.02/60.03 BLOQ, 55.03 sob gate parcial — sem promoção nesta auditoria.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/OPERACAO.md)

> L7: - [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.

> L18: - **Fontes de operação:** [`infra/README.md`](https://github.com/delmacy/syndes-system/blob/main/infra/README.md), [`scripts/control/module_migrations.py`](https://github.com/delmacy/syndes-system/blob/main/scripts/control/module_migrations.py) e [referência técnica](REFERENCIA-TECNICA.md). Os comandos de mutação são restritos a operadores/gates próprios, não reproduzidos aqui.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

> L45: No checkpoint, esse comando mostrou **seis migrations PENDING** e `PLAN ONLY: no Control DB changes`. **Não usar `--apply`** sem aprovação do owner e evidência explícita de backup/restore; o modo de aplicação tem gates próprios de SHA, ledger, lock e revisão.

> L60: 4. Executar migrações de módulo somente no tenant aprovado, com role própria e digest autorizado; Support é restrito ao tenant operacional Syndes e multi-org continua sob gate manual.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/06-wbs-marcos-e-aceite.md)

> L3: A [EVOLUÇÃO](../EVOLUCAO.md) é a ligação canônica dos **7 IDs** ao [programa](../../../engineering/WBS-PROGRAMA-SYNDES-20261110.md). O estado foi preservado do snapshot original; a auditoria de documentos **não executa** tasks ou Product Gates.

> L5: \| ID de origem \| Objetivo/gate \| Estado da WBS \| Fato conhecido após auditoria \|

> L7: \| **10.02** \| Revisar roles, CONNECT e grants A/B por banco \| **PEND** \| No único tenant: PUBLIC/core/master não conectam e owner exclusivo não tem superuser; falta teste funcional/roles completas \|

> L8: \| **10.07** \| Backup/restore de Control e tenants, RPO/RTO \| **BLOQ (operação)** \| Teste sintético de CI existe; restore de ambiente persistente **não verificado** \|

> L11: \| **55.03** \| Installer, gates de canonicidade e schema \| **BLOQ em Control/restore/FGA reais** \| Código e CI em PG17 existem; Control live carece de catálogo e ledger/tenant sem schema \|

> L17: \| Gate \| Prova necessária \| Situação \|

> L23: \| Testes descartáveis \| CI por SHA e suíte PG17 \| [Run 43355545663](https://github.com/delmacy/syndes-system/actions/runs/43355545663) **24/24** na baseline \|

> L33: 5. **I04/C03/C04/A05:** ampliar matriz de grants com testes negativos reais, sem consultar dados privados.

> L34: 6. **G02/owners:** Product Gate separado para Support, módulos, multi-org e Client/Manager.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
