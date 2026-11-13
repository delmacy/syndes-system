# I02 — Hospedagem e ambientes | Operação

> **RUNBOOK DE CONSULTA SOMENTE LEITURA — NÃO HOMOLOGAÇÃO OPERACIONAL.** A inspeção do DevServer01 em 12/11/2026 não autoriza mudanças em containers, dados, rede ou produção.

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
- **Runbook específico:** [DevServer01](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md) é histórico; inventário de runtime e lacunas estão na [Referência técnica](REFERENCIA-TECNICA.md). Não reutilizar comandos de deploy de snapshot antigo por inferência.

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
- **Hospedagem por ambiente:** [I02 — inventário e STATUS](STATUS.md) e [I03 host auxiliar](../I03-win1-server/OPERACAO.md). **Não foi comprovado** que I03 ou server02 sejam staging ou produção.
- **Ferramentas:** [Docker](../I05-docker-e-redes/REFERENCIA-TECNICA.md), [Traefik](../I06-traefik-https/REFERENCIA-TECNICA.md), [Tailnet](../I07-tailnet/OPERACAO.md) e [Komodo](../I08-komodo/REFERENCIA-TECNICA.md).
- **Dados e resiliência:** [PostgreSQL](../I04-postgresql/REFERENCIA-TECNICA.md), [Backup/Restore](../I10-backup-e-restore/OPERACAO.md), [Release/Rollback](../I11-release-e-rollback/OPERACAO.md).

Ao solicitar mudança, especifique **ambiente → serviço → host → alteração**. O nome antigo da máquina não deve definir a fronteira de responsabilidade do módulo. Não registrar segredos e endereços privados no Pages.

## Procedimento seguro para renovar o inventário (sem dados privados) {#inventario-seguro}

1. Confirmar host, ambiente, autorização de consulta, data/hora e SHA do checkout do repositório; **não** inferir deploy pelo Git.
2. Consultar **apenas metadados** da execução, sem `docker inspect` integral nem valores de `Env`, secrets, mounts de origem, routes ou domínio:

   ```bash
   docker version --format 'Engine={{.Server.Version}}'
   docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Label "com.docker.compose.project"}}'
   docker network ls --format '{{.Name}}|{{.Driver}}'
   docker volume ls -q | wc -l
   ```

3. Para publicar, **redigir um resumo por função**, removendo nomes de host, portas, IPs, logs privados, values de env e caminhos físicos de mounts. Conferir Compose declarado versus services observados e ownership de cada overlay/preview.
4. Registrar `DECLARADO`, `OBSERVADO`, `TESTADO`, `HOMOLOGADO` e `NÃO VERIFICADO` separadamente, com SHA do código e instante da coleta.
5. Não parar, remover, reiniciar ou coletar dados de containers avulsos (incluindo o PostgreSQL PG17 de teste) sem confirmação do owner e plano próprio.
6. Validar por outra frente TLS/firewall/Tailnet, backup/restore, DR e Product Gate. A aprovação do CI não comprova o host.

**Amostra já registrada:** [STATUS I02](STATUS.md), [snapshot e origem](REFERENCIA-TECNICA.md), [riscos](chapters/07-controle-do-escopo.md).
