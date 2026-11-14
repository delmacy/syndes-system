# I11 — Release e Rollback | STATUS

> Auditoria **estática parcial** de 13/11/2026. Base GitHub `main` `3a943ea518df2239525d2f518bb1b061671bc358`; fonte `infra/master-admin/homolog-deploy.sh` (blob `39f85b3ec07b92a90f3e83408c3ad2541ec6fcf3`). Não comprova execução nem homologação.

## Estado por dimensão

| Dimensão | Estado | Evidência / limite |
|---|---|---|
| Fonte | Encontrada | Script Bash de deploy isolado do Platform Manager, não mecanismo universal de release |
| Documentação | Auditoria parcial | Fluxo e limites extraídos da fonte |
| Testes | Não verificados nesta revisão | Nenhum comando do script executado |
| Integração | Não verificada | Requer ambiente e artefato CI aprovados |
| Deploy / homologação | Não comprovados | Mensagem de sucesso no código não é evidência de execução |
| Rollback | Implementação declarada, não testada | Trap de erro limita teardown ao stack Manager e à rota que reconhece como própria |

## Contratos estáticos observados

- Modos aceitos: `--preflight` e `--apply`; diretório de execução restrito a dois checkouts aprovados do Manager no DevServer01.
- Preflight exige Docker, jq, Tailscale, Python, PostgreSQL saudável, Keycloak, redes internas, role e owner no Control, OpenBao acessível, segredos em tmpfs com permissões específicas.
- Valida manifesto do frontend compilado em CI, SHA de origem, histórico Git, ausência de alterações rastreadas e consistência de fonte frontend com artefato.
- Exige hostname Tailnet, issuer OIDC compatível e porta HTTPS dedicada livre; verifica novamente antes de configurar Serve, sem Funnel público.
- Em `--apply`, constrói imagens locais, sobe Compose isolado, aguarda HTTP local, registra configuração Serve anterior e verifica rota privada.
- Em falha após início do apply, a rotina de rollback tenta remover apenas a rota de sua propriedade e o Compose Manager. Não há comprovação de rollback completo de dados ou restauração de estado externo.

## WBS e próximos gates

| ID | Estado | Próxima evidência |
|---|---|---|
| I11.DOC.01 | Parcial | Reconciliar referência, operação e oito capítulos temáticos com owners |
| I11.TEST.01 | Pendente | Testes estáticos e preflight isolado autorizado, sem `--apply` |
| I11.OPS.01 | Bloqueado | Evidência de deploy, smoke, rollback e aceite operacional por SHA |

## Checkpoints

| Data | Resultado | SHA / CI / ambiente | Continuidade |
|---|---|---|---|
| 2026-11-12 | Baseline documental | Sem evidência operacional | Auditar fonte |
| 2026-11-13 | Fonte Bash auditada estaticamente | `main 3a943ea`; blob `39f85b3`; CI e ambiente não executados | Revisar owners, gates e documentos complementares |

Nenhum witness de símbolo AST foi acrescentado: Bash e gates de shell exigem registro apropriado com caminho/linha verificados. Este checkpoint não altera estados das outras 56 unidades.
