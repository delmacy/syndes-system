# I02 — server02 | Operação

> **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

## Estado operacional e evidências

- [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.
- [SPRINT](SPRINT.md): incremento autorizado e checkpoints, quando existentes.
- [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.
- [Histórico](HISTORICO.md): commits de código e documentos.
- [Workflows GitHub](../../monitoramento/README.md): resultado CI geral, não estado operacional do módulo.

## Fontes e contratos

- [Código/artefato do módulo](https://github.com/delmacy/syndes-system/tree/main/infra) — `infra`.
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

## Ambientes e componentes de suporte {#hospedagem}

O conjunto de hospedagem agora é gerido documentalmente em **I02 — Hospedagem e ambientes**. Os IDs de host e serviços permanecem no catálogo para rastreabilidade, mas não são mais módulos paralelos no menu.

- **Desenvolvimento:** [I01 — DevServer01](../I01-devserver01/OPERACAO.md) e seu [runbook](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md).
- **Hospedagem e produção:** [I02 antigo server02](../I02-server02/STATUS.md) e [I03 host auxiliar](../I03-win1-server/OPERACAO.md). Atribuições reais de homologação/produção e estado corrente **a auditar**.
- **Ferramentas:** [Docker](../I05-docker-e-redes/REFERENCIA-TECNICA.md), [Traefik](../I06-traefik-https/REFERENCIA-TECNICA.md), [Tailnet](../I07-tailnet/OPERACAO.md) e [Komodo](../I08-komodo/REFERENCIA-TECNICA.md).
- **Dados e resiliência:** [PostgreSQL](../I04-postgresql/REFERENCIA-TECNICA.md), [Backup/Restore](../I10-backup-e-restore/OPERACAO.md), [Release/Rollback](../I11-release-e-rollback/OPERACAO.md).

Ao solicitar mudança, especifique **ambiente → serviço → host → alteração**. O nome antigo da máquina não deve definir a fronteira de responsabilidade do módulo. Não registrar segredos e endereços privados no Pages.
