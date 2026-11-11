# ADR — Ensaio sintético de backup e restore dos ledgers (2026-11-11)

**Decisão:** antes de autorizar qualquer migration ou worker em ambiente operacional, testar restauração de eventos e de suas referências de negócio com um PostgreSQL 17 **descartável**, isolado e com dados falsos. Este ADR **não homologa** o backup nem o restore dos bancos reais.

## Artefatos e execução

Ferramenta: `scripts/events/disposable_restore_drill.py`.

```bash
python3 -m unittest scripts/events/test_disposable_restore_drill.py scripts/events/test_staging_preflight.py -v
python3 scripts/events/disposable_restore_drill.py --disposable --ack-synthetic --json
python3 scripts/events/staging_preflight.py --json
```

O script exige ambas as flags de segurança e **não aceita host, DSN, tenant, container, database, arquivo de entrada ou credenciais fornecidos pelo operador**. Usa `postgres:17-alpine` em contêiner **novo**, de nome aleatório com label própria, **`--network none`**, sem `-p`, sem bind mounts nem volumes persistentes e com limites de memória/processos. Todos os comandos PostgreSQL rodam por `docker exec -u postgres` e socket Unix **dentro do contêiner descartável**. O contêiner é eliminado no `finally` e os arquivos de backup temporários têm diretório 0700 e permissões 0600, eliminados após a verificação. Não entra no PostgreSQL operacional.

### Escopo efetivamente exercitado

1. **Control DB sintético**: cria somente dentro da fixture um database chamado `syndes_control`, aplica `control.schema` e migrations de catálogo, lifecycle, attestation, activation, manager-readonly e `006_control_events`; insere um tenant de teste, módulo CRM e transição de entitlement. O trigger cria o evento de auditoria no mesmo commit.
2. **Tenant DB sintético**: aplica as migrations necessárias de Organizations, CRM, Inbox, WhatsApp e `platform_events` (001/002). Cria uma organização/workspace, pessoa de teste, conta WhatsApp, conversa, inbound textual e dois envelopes: `crm.person.created.v1` e `whatsapp.message.received.v2`. Inclui entrega completada com `consumer_inbox` e entrega em estado `retry`.
3. **Backups por database**: usa `pg_dump -Fc --no-owner --no-acl` para Control e tenant. Verifica assinatura `PGDMP` e SHA-256 antes do restore. Sem arquivar ou imprimir payloads.
4. **Restore**: cada dump é restaurado em **outro database dentro do mesmo contêiner isolado** por `pg_restore --single-transaction --exit-on-error --no-owner --no-acl`. Snapshots normalizados de registros/referências de Control e tenant devem ser idênticos antes/depois.
5. **Recuperação**: testa transição do módulo no Control restaurado (trigger intacto), negativa de SELECT para a role de Core, e replay sintético da entrega pendente **duas vezes**, com apenas um efeito e uma marca em `consumer_inbox`. Os bancos de origem sintéticos devem permanecer inalterados.

## Evidência local

Execução realizada no DevServer01 em 2026-11-11:

- **13/13 testes de unidade**, incluindo target allowlist, flags obrigatórias, pg_restore transacional, checksum/arquivo truncado, permissões de backup e ausência de DSN/host externo.
- **11 verificações de integração aprovadas** na fixture PostgreSQL 17 (source, custom archives, checksum, restauração, auditoria, trigger, ACL, tenant ledger, inbox, replay idempotente e fonte inalterada).
- Relatório com `result: "passed_synthetic_only"`, `network: "none"`, `production_backup_verified: false`, `production_restore_approved: false` e `operational_ddl_executed: false`.
- Nenhum contêiner de ensaio permaneceu ativo ao fim.

## Limitações explícitas

- Isto **não** testa backups dos databases operacionais nem tempo real de recuperação em volumes reais, e não habilita DDL/DML operacional.
- `pg_dump` por database não reproduz roles/grants globais, segredos OpenBao, configurações de infraestrutura, certificados, Keycloak/FGA, réplicas, WAL/PITR, rotina automatizada de backup, criptografia at rest, retenção, offsite ou RPO/RTO. `--no-acl --no-owner` significa que grants e ownership devem ser homologados **separadamente**, não copiados cegamente.
- A fixture cobre tabelas de **eventos e dependências principais do MVP**, e não todos os módulos/objetos operacionais. Não interpretar a execução como backup completo do tenant real.
- O replay é uma simulação transacional, não uma instância do worker real; scheduler, autorização de serviço, module ENABLED e integração com gateway operacional continuam pendentes.

## Gate operacional seguinte (bloqueado)

O próximo teste de restore de **backup real** precisa de inventário e autorização específicos: janela, custódia de segredos, escopo de dados, host/container de restore isolado, criptografia, role/ACL, plano de reversão, critérios de comparação de dados, riscos de privacidade e evidência de RTO/RPO. Não copiar dados pessoais para fixture nem acionar migrations de Control 001–006 ou tenant `platform_events` 001–002 antes de cumprir esse gate.

**Matriz de estados:** ferramenta implementada/testada (sim) · CI (pendente até PR) · dados operacionais recuperáveis (não comprovado) · schema implantado (não) · event worker ativado (não) · frontend integrado com Event Bus (não).
