# I10 — Backup e Restore: auditoria de fronteira (2026-11-15 07:00 BRT)

## Base e ownership
- Base canônica consultada: `1cf48cc0a1281017ac58f7b9b9747f663109e151` (main, GitHub MCP); branch exclusiva: `audit/i10-backup-restore-source-20261115-0700`.
- Catálogo `catalog/work-units.json`: I10, qualidade, `scripts/events/disposable_restore_drill.py`, maturity=`partial`. Maturidade catalogada não é resultado de teste, deploy ou aceite.
- Contrato global: `AGENTS.md` exige backup e restore testado; `docs/engineering/MAINLINE-CI-POLICY.md` distingue integração de release e exige backup/rollback para produção.

## Superfície pública e privada efetivamente examinada
- CLI pública do script Python: `--disposable --ack-synthetic [--json]`; ambos flags obrigatórios. Saída estruturada `syndes_synthetic_pg17_restore_v1`, sucesso `passed_synthetic_only`, falha com tipo de exceção e exit 1.
- Funções/classes internas: `DrillError`, `safe_database`, `run`, `Postgres.command/sql/dump/restore`, `sql_file`, `seed_control`, `seed_tenant`, `collect`, `sha`, `verified_archive`, `restore_drill`, `main`. `run` suprime stderr SQL e impõe timeout.
- Isolamento declarado no código: container PostgreSQL 17 Alpine aleatório, `--network none`, sem portas publicadas/volume persistente, bancos e registros sintéticos; arquivos temporários chmod 0600 em diretório 0700; arquivos dump `PGDMP` e SHA256 verificados; remoção do container no finally. Isso é evidência de implementação, não de execução.
- SQL/schema dependentes: seis schemas de Control Plane e migrations de Organizations, CRM, Inbox, WhatsApp e eventos Core Host, enumerados em `CONTROL`/`TENANT`. São **aplicados somente pelo drill** no banco sintético se executado; nenhuma migration executada nesta auditoria.
- Eventos: Control Plane `control_events.outbox_events` e tenant `platform_events.outbox_events`, `event_deliveries`, `consumer_inbox`; fixtures `crm.person.created.v1` e `whatsapp.message.received.v2`. Verifica contagens, payloads, constraint, trigger, ACL e replay idempotente após restauração.
- APIs HTTP próprias: não identificadas no arquivo I10; o mecanismo é CLI, não serviço HTTP. Classes de negócio externas não foram re-auditadas nesta rodada.

## Achados e limites
- I10-01: o mecanismo é um **ensaio sintético de backup/restore**, não prova de backup operacional, restore real, retenção, criptografia em repouso, recuperação offsite, RPO/RTO ou recuperação de credenciais/configurações.
- I10-02: o drill usa Docker `run`, SQL DDL, `pg_dump` e `pg_restore` em ambiente descartável. Por ser mutável, **não foi executado** sob a restrição read-only desta auditoria.
- I10-03: a lista `CONTROL`/`TENANT` é fixa. Cobertura de migrations posteriores ou de novos owners exige comparação com o inventário atual antes de declarar cobertura completa. Não foi feita varredura exaustiva de toda a árvore de migrations.
- I10-04: o script confere integridade por checksum SHA256 e permissões locais, mas explicitamente informa que os dumps temporários **não são criptografados**. Não afirmar proteção criptográfica.
- I10-05: `finally` solicita `docker stop` com `check=False`; não há comprovação operacional nesta rodada de limpeza bem-sucedida em falhas excepcionais.
- Evidência adicional: `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md` descreve backup de dist/manifests para Workspace e rollback estático, mas não prova recuperação de bancos em produção; o documento registra observações históricas de 2026-11-01, não estado atual do host.
- Testes executados: **nenhum**. Testes CI associados ao SHA: **não verificados**. DevServer01: **não acessado**. Deploy/homologação, restore real e GitHub Pages SHA: **não comprovados**.

## Próximos gates
1. Comparar todas as migrations atuais com as listas fixas do drill e documentar exclusões justificadas.
2. Verificar testes automatizados e evidências CI no SHA exato sem executar operações mutáveis.
3. Definir gate de restore operacional isolado, com criptografia, retenção, RPO/RTO, validação de integridade e aceite autorizado — sem confundir com drill sintético.
4. Reconciliar I10 com I11/Q08 e demais unidades; não declarar 57/57, divergências zero ou Pages publicado sem provas específicas.

## Fronteiras de alteração
Somente este checkpoint Markdown novo na branch própria; sem merge, código, SQL, migrations, workflows, segredos, deployment ou alteração de branches alheias.
