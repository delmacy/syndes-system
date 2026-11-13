---
title: "I04 · Operação e implantação"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Operação e implantação

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)

> L28: 5. **P1 — Backup e reversibilidade desconhecidos.** `pg_dump` de fixture em CI não substitui restore de Control+tenants com RPO/RTO, rollback e papéis.

> L36: \| **10.07** \| Plano backup/restore de Control e tenants \| BLOQ (operação) \|

> L50: \| 13/11/2026 \| CI GitHub da baseline `1395597` \| [24/24 success](https://github.com/delmacy/syndes-system/actions/runs/43355545663) \| Deploy real, staging, produção e Product Gate \|

> L54: **Status final: auditoria documental/SQL parcial; banco de desenvolvimento observado; produto e operação não homologados.**

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/REFERENCIA-TECNICA.md)

> L12: \| Segurança e redes \| Compose e [`infra/README.md`](https://github.com/delmacy/syndes-system/blob/main/infra/README.md) \| `syndes-data`, `syndes-master-data`, SCRAM para host, secret files; saúde e firewall dependem da operação \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/OPERACAO.md)

> L3: > **RUNBOOK DE CONSULTA E AUDITORIA, NÃO PROCEDIMENTO DE IMPLANTAÇÃO.** A inspeção de 13/11/2026 foi somente leitura de catálogos de desenvolvimento. Não executar migrations, provisioning, alterações de privilégios, backup ou restore a partir desta página.

> L18: - **Fontes de operação:** [`infra/README.md`](https://github.com/delmacy/syndes-system/blob/main/infra/README.md), [`scripts/control/module_migrations.py`](https://github.com/delmacy/syndes-system/blob/main/scripts/control/module_migrations.py) e [referência técnica](REFERENCIA-TECNICA.md). Os comandos de mutação são restritos a operadores/gates próprios, não reproduzidos aqui.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

> L59: 3. Validar backup consistente, restore real em banco segregado, rollback e autorizações antes de escrever em DB persistente.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/06-wbs-marcos-e-aceite.md)

> L8: \| **10.07** \| Backup/restore de Control e tenants, RPO/RTO \| **BLOQ (operação)** \| Teste sintético de CI existe; restore de ambiente persistente **não verificado** \|

> L13: \| **60.03** \| Ativação manual multi-org transacional com rollback \| **BLOQ** \| Não aprovada/aplicada nesta auditoria; manter guardas do SQL 002 \|

> L25: \| Staging/produção \| Operação e aceite no host-alvo \| **Não verificados** \|

> L29: 1. **I04/C01:** reconciliar `syndes_control` e histórico de migrations com o migrador `--plan`, identificar owner e estado de operação antes de qualquer `--apply`.

> L32: 4. **I10/Q08:** comprovar backup/restore e rollback em staging autorizado, com RPO/RTO quando houver medição.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
