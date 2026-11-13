## 6. WBS, marcos e aceite da Q07

### Tarefas associadas existentes

A [EVOLUÇÃO da Q07](../EVOLUCAO.md) vincula dois workitems da [WBS mestre](../../../engineering/WBS-PROGRAMA-SYNDES-20261110.md). Essa associação não cria uma sprint nova:

| WBS | Entregável original | Situação documental nesta revisão |
|---|---|---|
| **00.07** | Matriz do CI central por impacto, `front-shared` e Workforce | Cobertura parcial em código; planner revisado para Serviço e testes locais; **gate remoto ainda precisa comprovar** |
| **95.02** | CI integrado com testes negativos preservados | Paridade local reparada, Serviço PG17 aprovado localmente; falta GitHub full `success` no SHA integrado |

### Checkpoint de correção pontual

| Item verificado | Antes da alteração | Depois do reparo local |
|---|---|---|
| `node --test scripts/ci/*.test.mjs` | 16/17 PASS; falha por dois workflows Docs extras | 19/19 PASS, com teste adicional de trigger |
| `bash tests/integrity/repository-structure.sh` | Não era a falha central | PASS no checkout alterado |
| `bash -n scripts/ci/*.sh` | Obrigatório pelo workflow | PASS no checkout alterado |
| `plan.mjs full` | 14 suites instaladas | 15 suites, incluindo Serviço |
| `run-suite.sh service-management` | Suite não registrada | Check/build, 19 testes NestJS/PG17 e `npm pack --dry-run` PASS |
| CI remoto do novo SHA | **Ainda não executado no checkpoint local** | Registrar somente após run completo, sem inferir release |

### Critérios de conclusão técnica

- `foundation` e `impact` **success** no mesmo SHA do commit.
- `regression` executa todas as suites instaladas em push `main`, inclusive Serviço, com testes PG17 **não ignorados**.
- Paridades Manager/Support executam quando requeridas, de acordo com o planner.
- `gate` só recebe **success** após jobs obrigatórios e evidências; `skipped` necessário não passa.
- Release e Product Gate permanecem externos ao CI e exigem autorização operacional explícita.

**Próximo módulo na ordem de auditoria documental:** **Q01 — Plataforma de testes**. Se a CI identificar defeito adicional, priorizar o bloqueio na Q07 antes de classificar `main` como saudável.
