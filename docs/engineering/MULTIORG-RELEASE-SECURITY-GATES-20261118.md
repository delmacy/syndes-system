# Gate operacional multi-organização — pendências mensuráveis

**Registro:** 2026-11-18 · **Estado:** `PRODUCTION_GATE=BLOCKED`. Não é autorização para remover SQL002.

## Autoridade de identidade e escopo

- Keycloak: única credencial e membership atual de Keycloak Organizations.
- Control: tenant ativo, entitlement e vínculo imutável Keycloak Org ↔ Platform Org.
- Tenant DB: ownership de Organization, Workspace, Funnel e memberships operacionais; transações e epoch.
- OpenFGA: grants por recurso/capability, sem credenciais.

## Invariantes de corte

1. Um mesmo usuário autorizado em Organization A e B consegue operar cada escopo apenas com grant, memberships atuais e ownership dos recursos respectivos.
2. JWT válido de Organization B **revogada** não autoriza B, mesmo que SQL mantenha membership antiga e FGA mantenha tuple.
3. Diretório de Organizations **não** pode revelar B após revogação no Keycloak: aplicar leitura live por link Control bidirecional antes de devolver linhas; falhas externas negam.
4. Rota histórica SQL-only `POST /v1/tenants/:id/platform/organizations` **não** pode criar uma Organization incompleta (sem Organization Keycloak nem link Control). Permanece NEGADA em multi-org até saga idempotente e reconciliável.
5. Bootstrap histórico e backfill são operações de contexto inicial sob SQL002; não são API de signup e permanecem NEGADOS após cutover sem sua própria reconciliação.
6. Toda mutação sensível de Inbox/Service exige capability exata FGA + epoch tenant-first na mesma transação; validações de ownership/teams/capability de Funnel não podem ser substituídas por grant tenant-wide.
7. Workers WhatsApp/outbox/eventos e SSE devem publicar e consumir tenant+org+workspace, nunca vazar dados, inclusive em múltiplas réplicas. Se sem broker compartilhado, a homologação limita explicitamente a **uma** instância Core e valida seu fallback.
8. Backup/restauração de staging: restaurar schema+dados **após** corte, compará-los com o estado anterior, reexecutar revogação, confirmar novos dados e plano de rollback sem recriar índices SQL002 com múltiplas orgs existentes.
9. `manual/activate_multiple_organizations.sql` é operador-only, não migration automática; as três attestations por session settings **não são ACL** nem provam aprovação de produto. O gate vem de evidências externas auditáveis.

## Evidências existentes

- TOPO-03C PG17: transação de escrita vs revogação, outbox atômica, estado após commit.
- TOPO-04A/B: duas Keycloak Organizations reais, mesmo JWT humano, grants exatos FGA e Inbox claim com auditoria, negativos A/B.
- TOPO-05A/B/C: Inbox SSE fail-closed, CRM/WhatsApp module entitlement, Organizations membership atual no Host.
- TOPO-05D: Service business real PG17 2 Organizations × 2 Workspaces × 2 funis; as provas específicas constam da PR #194, cujo gate central precisa ser aprovado.
- TOPO-05E: filtro de diretório Organizations e bloqueio de bootstrap/criação SQL-only, quando `SYNDES_MULTI_ORG_ENABLED=true`; prova em PR de segurança, CI pendente.

## O que impede `PRODUCTION_GATE=READY`

| ID | Evidência necessária | Resultado |
|---|---|---|
| G-1 | Inbox/Service **todas** as mutações montadas no Host real usam FGA exato e fence, não o coarse FGA | NÃO COMPROVADO |
| G-2 | Workers e exports CRM/WhatsApp/Inbox com dados de duas Organizations, revogação e isolamento | NÃO COMPROVADO INTEGRALMENTE |
| G-3 | Saga de criação de Organization Keycloak + SQL + Control Link, idempotente, sem órfãos | NÃO IMPLEMENTADA |
| G-4 | Restore e rollback de staging com dados multi-org, checklist assinado | NÃO COMPROVADO |
| G-5 | Comunicação SSE multi-host, ou restrição de topologia single-host validada | NÃO COMPROVADA |
| G-6 | Aprovação e implantação da migration de cutover em tenant controlado exclusivamente via CI/CD | NÃO EXECUTADA |

**Regra de release:** só mudar Product Gate de BLOCKED para READY quando G-1..G-6 tiverem testes e provas vinculados a commits/SHA e execução CI real. Nenhuma documentação ou teste isolado substitui essa condição.


## TOPO-05F — prova de restore DESCARTÁVEL, não homologação staging

- Após TOPO-05D, a suite `modules/service-management/test/service-funnels-pg17.test.mjs` cria um arquivo **pg_dump -Fc** do tenant PG17 multi-org descartável, verifica seu cabeçalho `PGDMP` e checksum SHA-256 e executa `pg_restore` em um segundo banco descartável no mesmo container Docker.
- A suite exige, depois da restauração: duas Organizations, quatro Workspaces, oito funis novos, attendances/eventos preservados, estado de membership B1 revogado e A2 ativo, índices SQL002 ausentes e FK que nega um funil declarado em Organization B com Workspace da Organization A.
- Marcador esperado `IAM_TOPO05F_PG17_MULTI_ORG_PGDUMP_RESTORE_REVOCATION_AND_FK_PASS`; resultado não presumido antes da CI. Banco restaurado descartado em `finally`.
- Esta prova **não** constitui G-4: staging com credenciais reais, backup externo/versionado, controle de acesso, restauração de Control + tenant e reconciliação de Keycloak/FGA ainda precisam de execução aprovada via GitHub Actions. `PRODUCTION_GATE=BLOCKED`.
