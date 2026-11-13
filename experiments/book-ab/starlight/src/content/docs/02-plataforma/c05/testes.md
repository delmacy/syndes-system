---
title: "C05 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)

> L11: \| Consumidor Core Host \| `loadCoreSecrets` lê AppRole de arquivos, exige TLS, KV obrigatório, revoga token bootstrap \| Testes mockados; app runtime real não validado \|

> L14: \| Testes \| `apps/core-host/test/secrets.test.mjs` e script `tests/platform/openbao-smoke.sh` \| Smoke é teste **descartável**; não foi executado contra o OpenBao atual \|

> L29: \| C05.DOC.01 \| **AUDITORIA PARCIAL** \| Artefatos, contratos, testes e limites reconciliados \|

> L32: \| C05.OPS.01 \| PENDENTE \| Testes em ambiente-alvo de rotação, reload, Raft snapshot/restore, recovery key custody e auditoria \|

> L33: \| C05.GATE \| BLOQUEADO \| Aceite dos owners C05/A04/C03/C04, sem exposição de material secreto \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/REFERENCIA-TECNICA.md)

> L26: **Notas:** O Core Host tenta revogar o token inclusive após erro no read. Revogação malsucedida bloqueia startup. Este comportamento está em `secrets.test.mjs` com fetch mockado; nenhuma prova de token revogado em ambiente real foi obtida. `render_runtime.py` tem garantia de falha por exceção para requests, mas a revogação é um gate operacional a observar em integração.

> L48: - `infra/security-access/openbao/README.md`: runbook de preparação/DR, com limites explícitos da migração. A checagem só de conteúdo documental não implica resultado de CI ou teste in-memory.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/OPERACAO.md)

> L8: 2. Verificar em ambiente autorizado a presença e versão de KV, AppRole, políticas mínimas por workload, restrições negativas e registro de auditoria; guardar evidência sanitizada e segregada.

> L16: - Nunca utilizar o smoke descartável `tests/platform/openbao-smoke.sh` contra volume real: o script inicializa um cofre de teste e usa identidade descartável.

> L18: - O Product Gate exige aprovação dos owners e evidência do ambiente-alvo.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/06-wbs-marcos-e-aceite.md)

> L9: \| C05.GATE \| Assinatura do owner + evidência de ambiente-alvo \| Bloqueado \|

> L11: O smoke em `tests/platform/openbao-smoke.sh` é **descartável e potencialmente destrutivo**, jamais deve ser aplicado no volume real como teste da documentação.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
