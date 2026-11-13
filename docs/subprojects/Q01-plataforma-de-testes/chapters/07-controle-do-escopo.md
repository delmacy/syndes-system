## 7. Controle de escopo, lacunas e decisões pendentes

**Esta revisão é documental.** Não adiciona testes que afetem o Host, altera migrations, habilita plugin, modifica autorização/roles nem executa fixtures que criem arquivos de segredo em serviços do DevServer compartilhado.

| Divergência / limite | Owner do encaminhamento | Situação |
|---|---|---|
| Q01 possui `tests/` mas as suites vivem também nos módulos e apps | Q01 + owners/Q07 | Registrar matriz por owner e não declarar uma biblioteca central única |
| `tests/integration`, `tests/security`, `tests/performance` têm AGENTS sem scripts próprios | Q02/Q03/Q04/Q05/Q06 + módulos | Reconciliar cobertura real; nenhuma meta numérica aprovada só pelo AGENTS |
| O CI integrado voltou a ficar verde na Q07 | Q07/Q10 | [Run 43340637846](https://github.com/delmacy/syndes-system/actions/runs/43340637846), **24/24** no SHA `bd0aa69`; estados de Q10 anteriores podem estar históricos |
| Teste PostgreSQL usa restore sintético | I10/Q08/Q09/Operação | Exigir backup, ensaio de restore e rollback realmente operacional no gate apropriado |
| `ci-secret-fixtures.py` grava em `/run/syndes/runtime` | Owner Q01/Infra | **Não executar** na estação compartilhada sem isolamento; somente CI disposable |
| `run-infra.sh` cria/remove redes e containers | Q07/Infra | Não executar no DevServer sem ambiente dedicado/autorizações |
| A suíte Serviço Basic passou em CI | P05/Q07 | Pacote ainda não está montado automaticamente no Host, sem Product Gate |
| Performance sob carga ainda é plano | Q06/Operação | Exigir medição de benchmark antes de dimensionar produção |
| Confusão entre documentação aprovada e operação | G02/Q10/owners | Registrar `NOT_RUN`, `BLOCKED`, `SKIPPED` sem reinterpretar como `PASS` |

### Critérios para revisar ou promover a Q01

1. Responsável de QA valida o inventário, a taxonomia e a matriz de donos.
2. Gaps por domínio são ligados a suites e issues reais, com execução e evidência por SHA.
3. Ambientes descartáveis, scripts e cleanup são revalidados após mudança relevante; não tocar credenciais operacionais.
4. Processos de performance/RC/restore real recebem evidências dos seus owners, separadas do gate Q07.
5. Product Gate/Go-live continuam sujeitos a aceite explícito — não basta o run verde do GitHub.

**Sem atualização de código de produto, workflows, scripts de plataforma, bancos, permissões ou ambiente operacional nesta frente.** A auditoria da Q01 permanece **parcial** até revisão formal.
