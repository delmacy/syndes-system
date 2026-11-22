# Plano executado — homologação multi-org no staging

Ambiente: projeto Docker isolado `syndes-multiorg-staging` no DevServer01. Somente GitHub Actions fez alterações. `PRODUCTION_GATE=BLOCKED`.

## Resultado verificável

- Fonte de aceitação: `4330a94a8a9c160daa5b11b3ce05b6342bbfd616`; [Actions 44988144506](https://github.com/delmacy/syndes-system/actions/runs/44988144506), job `137103804718` **success**.
- Core real: fonte `1e795f2d7579a021d230b8ba89347db95f744b7b`, mesma imagem antes e depois do restore `sha256:e4fdd5246ad0cd42bee8ee2b0679ea0104e6f875b20584e7e5a88cad00b5f02a`.
- `STAGE_CORE_REAL_HTTP_IDP_FGA_SQL_WORKER_SSE_ACCEPTANCE_PASS` ocorreu duas vezes. Matriz executada: dois tenants PostgreSQL, duas Organizations no tenant principal, quatro Workspaces, Keycloak/OIDC, OpenFGA, CRM/Inbox/Service via HTTP, worker WhatsApp sintético, SSE, singleton, revogação concorrente e negativas entre escopos.
- `STAGE_REAL_PROVIDER_OUTAGE_HTTP_DENY_ZERO_AUDIT_WRITE_PASS` ocorreu duas vezes, para indisponibilidade de provedor sem escrita indevida.
- Backup criptografado de Control, Keycloak, OpenFGA e dois tenants; restore em cinco bancos novos, comparação de contagens/hashes, ativação com originais arquivados e restore real do OpenBao. `STAGE_RESTORE_FIVE_REAL_DATABASES_ALL_TABLE_COUNTS_HASHES_MULTI_ORG_SQL002_STATE_PASS` e `STAGE_OPENBAO_ACTUAL_RAFT_SNAPSHOT_RESTORE_UNSEAL_PASS`.
- `STAGE_ACCEPTANCE_AND_ENCRYPTED_FIVE_DB_RESTORE_SAME_CORE_IMAGE_RECOVERY_PASS`; tempo medido de restauração dos bancos: **9 s**; recuperação completa até nova aceitação: **48 s**. Os hashes SHA-256 individuais estão no log do job.

## Aceite final sem diagnósticos temporários

Após limpar as sondas e semear as tuples do OpenFGA individualmente com verificação exata de idempotência, main `0d4bcbb65b2e77a82b8b28f289029b84ed4a7054`, [Actions 44989541139](https://github.com/delmacy/syndes-system/actions/runs/44989541139), job `137108180770` **success** repetiu duas passagens de `STAGE_CORE_REAL_HTTP_IDP_FGA_SQL_WORKER_SSE_ACCEPTANCE_PASS` e encerrou com `STAGE_ACCEPTANCE_AND_ENCRYPTED_FIVE_DB_RESTORE_SAME_CORE_IMAGE_RECOVERY_PASS`; RTO novamente **48 s**, mesmo digest Core. Essa é a evidência final do recorte greenfield.

## Correções produzidas durante a execução

O 403 inicial da Inbox exigia o registro auditável de ownership default em um tenant **greenfield**. O script só o registra após comprovar que não há dados históricos nas tabelas verificadas e que SQL002 já foi removido nessa fixture. O proxy Nginx tinha IP estático antigo que apontava para OpenFGA após restart; agora resolve Keycloak por DNS interno dinâmico e recebe configuração versionada e verificada por SHA. A restauração de PostgreSQL não copiava o privilégio efetivo de `CONNECT` no objeto DATABASE; o script preserva tanto a concessão do tenant ativo quanto a negação do tenant sintético.

## Limite da evidência e próxima etapa

Este aceite usa uma fixture greenfield. **Não comprova o backfill de dados históricos nem o cutover SQL002 em um banco operacional legado.** MO-REL-06 (#210) permanece aberta para fixture histórica, ordem Control/tenant 008–010, meia migração negada e rollback compatível com dados multi-org. Wizard/signup (#189), Product Gate e produção permanecem bloqueados. O resultado de staging E2E/restore não autoriza promover produção nem ativar WhatsApp externo.

## Ensaio adicional de dados históricos e IAM (MO-REL-06)

- Main `dc587d130fc994021d625041020b6c5c821bf7a0`, [Actions 45019251146](https://github.com/delmacy/syndes-system/actions/runs/45019251146): fixture histórica sintética anterior a 003 no PostgreSQL17 do staging; backfill de CRM, Inbox e WhatsApp, negação sem attestations e com SQL002 parcial, cutover e rollback completo do schema transacional.
- Main `60a96dd9da3d1689cf094169813f08213283f1ce`, [Actions 45019940500](https://github.com/delmacy/syndes-system/actions/runs/45019940500), job `137201125315` success: prova 008+010 com SQL002 presente, 009 negada; 010 negada em estado parcial; 009+010 e replay após cutover, 008 negada, nenhum grant ativado, transação revertida. Marcador `STAGE_HISTORICAL_LEGACY_ROWS_BACKFILL_PARTIAL_DENY_SQL002_IAM008_009_010_CUTOVER_ROLLBACK_PASS`.
- Main `577a736d181dc019860ff56024493cf6cd812e8a`, [Actions 45021167692](https://github.com/delmacy/syndes-system/actions/runs/45021167692): backup criptografado de fixture histórica sintética em banco isolado, restore em outro banco, comparação de IDs, ownership, auditoria e índices; cutover durável somente no clone via `psql -X --single-transaction -v ON_ERROR_STOP=1`, origem inalterada. RTO medido 3 s.
- Main `bc3b672795f4b2eb79b5a8e9f2552eecbba0a4ca`, [Actions 45022097742](https://github.com/delmacy/syndes-system/actions/runs/45022097742), job `137207829539` success: depois do cutover no clone, segunda organização sintética criada; reinstalação de SQL002 negada (`23505`); backup criptografado anterior ao cutover restaurado em terceiro banco compatível, comparado com origem. Marcador `STAGE_HISTORICAL_ENCRYPTED_RESTORE_MULTI_ORG_COMPATIBLE_ROLLBACK_PASS`, SHA256 do backup `d6e94ec545a4cdf4d81fbb87f5179580f711c5c4e15a519beee70b8ea8867859`, tempo observado do ensaio 5 s. Os três bancos temporários foram removidos pelo runner.
- **Pendente para encerrar #210/G-4:** exercício composto com histórico em uma cópia do tenant operacional de staging, migrations Control/tenant, reconciliação Keycloak/OpenFGA e prova de ownership/revogação após restauração. O clone atual contém dados sintéticos e schema `historical`, sem entradas IdP/FGA ligadas a esse clone. O tempo medido é do ensaio sintético, não RTO de recuperação do sistema completo; RPO operacional não foi medido. `PRODUCTION_GATE=BLOCKED`.
