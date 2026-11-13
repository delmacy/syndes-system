# I04 — PostgreSQL | Operação

> **RUNBOOK DE CONSULTA E AUDITORIA, NÃO PROCEDIMENTO DE IMPLANTAÇÃO.** A inspeção de 13/11/2026 foi somente leitura de catálogos de desenvolvimento. Não executar migrations, provisioning, alterações de privilégios, backup ou restore a partir desta página.

## Estado operacional e evidências

- [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.
- [SPRINT](SPRINT.md): incremento autorizado e checkpoints, quando existentes.
- [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.
- [Histórico](HISTORICO.md): commits de código e documentos.
- [Workflows GitHub](../../monitoramento/README.md): resultado CI geral, não estado operacional do módulo.

## Fontes e contratos

- [Código/artefato do módulo](https://github.com/delmacy/syndes-system/tree/main/infra/postgres) — `infra/postgres`.
- [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).
- [Regras de rastreabilidade](../../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).
- **Fontes de operação:** [`infra/README.md`](https://github.com/delmacy/syndes-system/blob/main/infra/README.md), [`scripts/control/module_migrations.py`](https://github.com/delmacy/syndes-system/blob/main/scripts/control/module_migrations.py) e [referência técnica](REFERENCIA-TECNICA.md). Os comandos de mutação são restritos a operadores/gates próprios, não reproduzidos aqui.

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

## Comprovação segura do estado (DevServer01) {#auditoria-sql-segura}

A auditoria coletou **somente catálogo e grants**, usando transação `BEGIN READ ONLY`. Não publicou UUIDs de tenant, nomes do DB adicional, linhas de negócio, secrets nem URLs.

O script versionado de consulta de migrations Control aceita o modo **não mutante**:

```bash
python3 scripts/control/module_migrations.py --plan
```

No checkpoint, esse comando mostrou **seis migrations PENDING** e `PLAN ONLY: no Control DB changes`. **Não usar `--apply`** sem aprovação do owner e evidência explícita de backup/restore; o modo de aplicação tem gates próprios de SHA, ledger, lock e revisão.

Para confirmar o container, é possível usar, em host autorizado:

```bash
docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Label "com.docker.compose.project"}}'
```

Esses metadados não provam schemas migrados. A versão PostgreSQL, os bancos e os grants foram conferidos na instância de desenvolvimento, **não em staging/produção**. Consultas adicionais devem passar por DBA/segurança e **jamais** publicar `docker inspect` completo, `pg_dump` ou linhas com PII.

## Regras de bloqueio para DDL, DR e deploy

1. Identificar ambiente, tenant/Control, release SHA, checksum e versão de imagem; **não escolher DB por parâmetro do cliente**.
2. Conferir DB e ledger existentes por owner. Em 13/11/2026 o Control relatou **seis etapas PENDING**, sem ledger; não aplicar automaticamente para tentar sanar a divergência.
3. Validar backup consistente, restore real em banco segregado, rollback e autorizações antes de escrever em DB persistente.
4. Executar migrações de módulo somente no tenant aprovado, com role própria e digest autorizado; Support é restrito ao tenant operacional Syndes e multi-org continua sob gate manual.
5. Registrar resultado por SHA/ambiente, com negativas de acesso, migrações aplicadas e schema compatível. CI de DB descartável **não** representa execução no DevServer.

**Bloqueios e próximos owners:** [STATUS I04](STATUS.md), [contratos](chapters/04-contratos-e-dependencias-publicas.md) e [WBS](EVOLUCAO.md).
