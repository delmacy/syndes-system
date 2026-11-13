---
title: "C05 · WBS e critérios de aceite"
description: "Volume Plataforma e core · capítulo C05 · matéria 06"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/06-wbs-marcos-e-aceite.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 6. WBS, marcos e aceite

| Marco | Verificação | Estado |
|---|---|---|
| C05.DOC.01 | Artefatos/contratos/runbooks e owners ligados | Auditoria parcial |
| C05.SEC.01 | Health, TLS, KV/AppRole e ACL efetivos sem expor segredo | Pendente |
| C05.SEC.02 | Matriz cross-service, roles e tokens negativos | Pendente |
| C05.OPS.01 | Raft backup/restore, rotação, restart, revogação, logs | Pendente |
| C05.GATE | Assinatura do owner + evidência de ambiente-alvo | Bloqueado |

O smoke em `tests/platform/openbao-smoke.sh` é **descartável e potencialmente destrutivo**, jamais deve ser aplicado no volume real como teste da documentação.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C05-secrets-openbao/chapters/06-wbs-marcos-e-aceite.md).
