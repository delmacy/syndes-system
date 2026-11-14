# I11 — Release e Rollback | Operação

> **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

## Estado operacional e evidências

- [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.
- [SPRINT](SPRINT.md): incremento autorizado e checkpoints, quando existentes.
- [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.
- [Histórico](HISTORICO.md): commits de código e documentos.
- [Workflows GitHub](../../monitoramento/README.md): resultado CI geral, não estado operacional do módulo.

## Fontes e contratos

- [Código/artefato do módulo](https://github.com/delmacy/syndes-system/tree/main/infra/master-admin/homolog-deploy.sh) — `infra/master-admin/homolog-deploy.sh`.
- [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).
- [Regras de rastreabilidade](../../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).
- **Runbook específico:** não verificado neste inventário. Não criar comandos de ambiente por inferência.

## Operações orientadas por agentes

- [Projeção / Planejamento](PROJECAO.md)
- [Implementação](IMPLEMENTACAO.md)
- [Alteração rápida](ALTERACAO.md)
- [Entrada de propostas](updates/README.md)

## Gates para operação real

1. Conferir fonte, tenant/org/workspace, ambiente, SHA e autorização explícita.
2. Validar identity/service grants e ownership de banco.
3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.
4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.
5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

---

## Sequência documentada, não executada — 2026-11-14

O script primeiro rejeita checkout não autorizado e dependências indisponíveis; valida saúde/identidade, segredo em tmpfs, proveniência do artefato, origem HTTPS privada e disponibilidade da rota. No modo `--preflight`, sai antes da mutação. No modo `--apply`, gera configuração temporária, constrói imagens, inicia o Compose isolado, espera o frontend local, salva configuração anterior do Serve e tenta vincular a rota privada 9447. Em erro, a compensação é limitada ao stack Manager e à rota que ele próprio atribuiu.

**Gates exigidos antes de homologar:** revisão de segurança e owner, sintaxe Bash, teste descartável dos ramos de falha sem segredos reais, evidência de preflight, smoke autenticado e teste de rollback com SHA e ambiente identificados. Esta revisão não executou nenhum desses comandos nem alterou ambiente.
