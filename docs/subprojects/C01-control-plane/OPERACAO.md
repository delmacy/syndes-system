# C01 — Control Plane | Operação

> **RUNBOOK DE CONSULTA, NÃO DE IMPLANTAÇÃO.** A auditoria C01 de 13/11/2026 examinou somente catálogo de PostgreSQL e código versionado. Não autoriza DDL, migrations, grants, workers ou leitura de dados pessoais.

## Estado operacional e evidências

- [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.
- [SPRINT](SPRINT.md): incremento autorizado e checkpoints, quando existentes.
- [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.
- [Histórico](HISTORICO.md): commits de código e documentos.
- [Workflows GitHub](../../monitoramento/README.md): resultado CI geral, não estado operacional do módulo.

## Fontes e contratos

- [Código/artefato do módulo](https://github.com/delmacy/syndes-system/tree/main/infra/postgres/bootstrap) — `infra/postgres/bootstrap`.
- [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).
- [Regras de rastreabilidade](../../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).
- **Fonte do migrador:** [`scripts/control/module_migrations.py`](https://github.com/delmacy/syndes-system/blob/main/scripts/control/module_migrations.py) e [WBS especializada CP-G](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-CONTROL-PLANE-EVENTS-20261111.md). A presença do script não autoriza `--apply`.

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

## Consulta não destrutiva do Control DB {#consulta-control-segura}

Para o host de desenvolvimento autorizado, o migrador oficial possui modo **somente leitura**:

```bash
python3 scripts/control/module_migrations.py --plan
```

No snapshot de 13/11/2026, informou **seis migrations PENDING** e `PLAN ONLY: no Control DB changes`; não criou ledger ou schema. A auditoria de catálogo usou `BEGIN TRANSACTION READ ONLY` e agregados sem UUID, principal, evento, PII, tokens ou credenciais.

Antes de qualquer alteração, exigir: comparação de runtime/consumer com schema realmente implantado; owners C01/I04/C02/A04/A05/C06; backup real e restore isolado ensaiado; checksum/SHA da release; janela e reversão; grants e testes negativos A/B; gate explícito. Não usar essa documentação como autorização operacional.

**Próxima verificação documental:** [STATUS](STATUS.md), [métodos por owner](REFERENCIA-TECNICA.md), [lacunas e riscos](chapters/07-controle-do-escopo.md).
