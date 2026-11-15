## 6. WBS, marcos e aceite

| WBS | Estado | Evidência necessária |
|---|---|---|
| I06.DOC.01 | Parcial | Compose, README, checkpoint I06 e revisão de owner |
| I06.SEC.01 | Pendente | Definição ativa e teste de negativa de `syndes-tailnet-only@docker` |
| I06.TLS.01 | Pendente | Certificado, entrypoint efetivo, redirecionamento e cliente TLS |
| I06.OPS.01 | Pendente | Manifests do runtime, correspondência de labels e smoke reversível |

Sem gate operacional nem aceite de produto nesta alteração. [STATUS](../STATUS.md) e [Operação](../OPERACAO.md).

| I06.TEST.01 | Divergência documental identificada | Remover build da categoria somente leitura; executar gates em ambiente isolado |
| I06.READY.01 | Pendente | Alinhar 401 esperado com 401/403 aceitos pelo probe e restringir declaração de PASS |
| I06.FUNC.01 | Pendente | Evidência independente de Inbox autenticado, autorização tenant e fluxo funcional |

Nenhum gate acima foi executado ou aprovado nesta atualização.
