# I10 — Backup e Restore | Referência técnica

> **Inventário estático parcial** da fonte `scripts/events/disposable_restore_drill.py` no SHA `8d17879b24fe3162f6b3e8a5776e25dd6d9cbc7b`; não representa implantação ou homologação.

## Stack e fronteira
Python 3, biblioteca padrão, Docker CLI e imagem declarada `postgres:17-alpine`. O script cria um PostgreSQL **descartável** com `--network none`, sem portas publicadas, usando dados sintéticos. O código exige `--disposable` e `--ack-synthetic`.

## Símbolos internos observados
- `DrillError`, `safe_database`: erro e whitelist de nomes de banco.
- `run`, `Postgres.command/sql/dump/restore`: invocação subprocess de `psql`, `pg_dump -Fc` e `pg_restore --single-transaction --exit-on-error`.
- `sql_file`, `seed_control`, `seed_tenant`: fixtures e scripts SQL explicitamente listados.
- `collect`, `sha`, `verified_archive`: coleta de fatos, SHA-256 e validação de permissões do arquivo.
- `restore_drill`, `main`: ciclo de ensaio e CLI. São símbolos de implementação, **não** API pública versionada.

## Contratos, dados e eventos
O ensaio referencia schemas de Control em `infra/postgres/bootstrap/` e SQL de tenant em `modules/organizations/sql/`, `modules/core-crm/sql/`, `modules/inbox/sql/`, `modules/whatsapp/sql/` e `apps/core-host/sql/`. A presença desses caminhos no script **não** comprova aplicação de migrations fora do contêiner descartável.

O script compara fatos de auditoria/outbox de Control, eventos/outbox, entregas e inbox de tenant; verifica gatilho de Control após restore, ACL de leitura do ledger e replay idempotente sintético. Não foram identificados endpoints HTTP, telas de frontend ou exports públicos específicos nesse arquivo; não inferir inexistência em todo o repositório.

## Limites de evidência
Não foi executado Docker, PostgreSQL ou SQL nesta revisão. O relatório produzido pelo script, quando executado, é explicitamente `passed_synthetic_only`, com `production_backup_verified=False`, `production_restore_approved=False` e `operational_ddl_executed=False`. A validade desses checks depende de execução futura observada, não da leitura do código.
