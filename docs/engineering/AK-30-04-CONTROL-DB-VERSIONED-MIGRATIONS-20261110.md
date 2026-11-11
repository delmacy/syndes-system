# AK-30.04 — Migração versionada e pré-flight do Control DB

**Estado:** ferramenta de preparação/reconciliação. As cinco migrations originais continuam **não aplicadas** no ambiente operacional e não foram registradas no bootstrap do Core Host. Atualização de 2026-11-11: a sexta migration candidata `006_control_events` foi acrescentada ao runner, também sem aplicação operacional. Data inicial: 2026-11-10.

## Artefato de execução

O script scripts/control/module_migrations.py usa somente Python stdlib e um PostgreSQL 17 previamente provisionado, acessado por Docker local com psql sob a identidade do superusuário via STDIN. Alvo fixo syndes_control; qualquer outro banco é negado. Não aceita caminhos SQL livres de parâmetros de HTTP/tenant. Todas as migrations são arquivos fixos deste repositório, com SHA-256 calculado dos bytes.

Ordem imutável:
1. 001_catalog: control-module-catalog.schema
2. 002_lifecycle: control-module-lifecycle.schema
3. 003_attestation: control-module-attestation.schema
4. 004_activation: control-module-activation.schema
5. 005_manager_readonly: control-module-manager-readonly.schema
6. 006_control_events: control-module-events.schema (outbox global de auditoria dos módulos, **sem dispatcher ativo**).

O ledger public.control_module_schema_migrations contém migration_key, SHA-256, commit da release e timestamp. Sem grants de runtime. O plano detecta checksum diferente, histórico fora de ordem, migrations desconhecidas e tabelas de módulos existentes sem ledger. Nesses casos **interrompe sem tentar corrigir automaticamente**.

A aplicação ocorre em **uma transação**, com advisory lock, lock_timeout, statement_timeout, validação do banco/PG17 e histórico SHA de cada script. Migrations já registradas com o mesmo hash são ignoradas. Qualquer erro SQL aborta a transação inteira. A segunda execução é NOOP.

## Pré-flight sem mutação

No checkout limpo do SHA a ser implantado, executar:

    python3 scripts/control/module_migrations.py --plan --container syndes-postgres-postgres-1

Este comando faz apenas SELECT de metadados e exibe estados PENDING/APPLIED, identificadores e SHA dos scripts. Não imprime senha/DSN nem consulta banco tenant.

## Proteções do modo de aplicação (não autorizado para a produção nesta entrega)

A opção --apply exige simultaneamente a variável de ambiente SYNDES_CONTROL_MIGRATION_APPLY=APPROVED_CONTROL_DB_ONLY, --approved-sha igual ao HEAD imutável do checkout e identificadores de backup e restore real ensaiado. O checkout não pode conter alterações rastreadas. Esses parâmetros são **barreiras contra execução acidental**, não prova automatizada de backups nem substituição da aprovação humana.

Antes de autorizar aplicação real:
- Registrar hash da release, operador responsável, janela e rollback.
- Executar backup consistente do Control DB, provar RESTORE em ambiente descartável e registrar evidências. Validar retenção, storage e recuperação de tenant DB separadamente.
- Confirmar PostgreSQL 17, tenant_registry, roles de serviço, ausência de migrations desconhecidas e SELECT mínimo para syndes_master_api.
- Rever impacto de locks/sessões abertas, ACL do activator e segredos no OpenBao. Nenhum serviço HTTP público recebe role de activation/DDL.
- Após aplicação, conferir ledger, leitura por Manager role sem DML/tenant DB, Keycloak/OpenFGA e rollback de serviço.
- Controllers legados ainda não chamam executeModule: migrations de metadados não ativam nem suspendem módulos no runtime.

## Evidência executada

- Pré-flight real DevServer01: syndes_control PG17, 1 tenant ativo, catálogo e entitlements não provisionados, cinco scripts PENDING. Somente leitura.
- O PostgreSQL mostrou archive_mode=off: isso **não comprova falta de snapshots/backups**, mas não há arquivamento contínuo WAL para PITR. Sem restore ensaiado, não autorizar deploy.
- PostgreSQL 17 descartável: cinco migrations aplicadas com ledger/commit/checksum; reexecução NOOP e checksum divergente bloqueado. Unit tests do planejador em scripts/control/test_module_migrations.py.
- Nenhuma migração real aplicada nem credencial criada.
- Incremento de 2026-11-11: a migration 006 foi aplicada e reexecutada **somente** em PostgreSQL 17 descartável, junto com 001–005, com trigger transacional, escopo FK e restrições de privilégios testados. O relatório histórico de cinco migrations PENDING permanece válido para o pré-flight anterior; após a PR4 o planejamento passa a listar seis scripts candidatos.

**Próximo gate:** backup/restore real e staging com identidades, least-privilege operator, reconciliação por tenant, todos handlers/workers protegidos e deploy com rollback observável.
