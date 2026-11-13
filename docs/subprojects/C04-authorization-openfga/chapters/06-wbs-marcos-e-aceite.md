## 6. WBS, marcos e aceite

| Marco | Evidência/aceite | Estado |
|---|---|---|
| C04.DOC.01 | Modelo, wrappers, testes, fronteiras e witness registry | **Auditoria parcial** |
| C04.SEC.01 | Provar modelo/store e tuples de homologação em leitura segura | Pendente |
| C04.SEC.02 | Provar denies A/B, user/service, client, scope, revogação | Pendente |
| C04.OPS.01 | Health, observabilidade sem PII, backup/restore e rollback | Pendente |
| C04.GATE | Owner/security sign-off com modelos/tuples revisados e CI por SHA | Bloqueado |

WBS relacionada: `docs/engineering/WBS-EVENTS-OPENFGA-SERVICE-20261111.md`. Testes in-memory não promovem serviço a DONE nem autorizam ativação do worker.
