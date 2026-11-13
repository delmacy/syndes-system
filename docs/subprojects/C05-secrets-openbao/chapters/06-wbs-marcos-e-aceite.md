## 6. WBS, marcos e aceite

| Marco | Verificação | Estado |
|---|---|---|
| C05.DOC.01 | Artefatos/contratos/runbooks e owners ligados | Auditoria parcial |
| C05.SEC.01 | Health, TLS, KV/AppRole e ACL efetivos sem expor segredo | Pendente |
| C05.SEC.02 | Matriz cross-service, roles e tokens negativos | Pendente |
| C05.OPS.01 | Raft backup/restore, rotação, restart, revogação, logs | Pendente |
| C05.GATE | Assinatura do owner + evidência de ambiente-alvo | Bloqueado |

O smoke em `tests/platform/openbao-smoke.sh` é **descartável e potencialmente destrutivo**, jamais deve ser aplicado no volume real como teste da documentação.
