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


## TOPO-06A — IAM07D no Host: integração parcial com deny explícito

- O Host agora oferece `SYNDES_IAM07D_OPS` (opcional fora de multi-org), montado SOMENTE com verifier OIDC de client autorizado, membership Keycloak Organizations atual, tenant Control ativo, module entitlement, link 1:1 Control, escopo SQL e ownership por funil, capability **exata** em store OpenFGA dedicada e tenant-first epoch fence com transação pinned.
- Em multi-org, `POST /v1/tenants/:id/inbox/conversations/:id/claim` chama o **mesmo** `Iam07dInboxBusinessPilot.claim` testado no laboratório; transfer de workspace usa `transfer` com grant exato, e `PATCH /service-management/attendances/:id/stage` usa `advance` após lookup scoped do funil no Service.
- As mutações legadas Inbox (criação, assignment genérico, status, handoff, favorite, read, contact, requestHistory, replies, notes, simulator) e Service (publish funnel, open, assign, team transfer, close) NEGAM 403 explicitamente em multi-org até terem capabilities e fences próprias; não há fallback para `inbox:messages/write` ou `service:attendances/write` no modo multi-org.
- Configurações adicionais obrigatórias em modo multi-org: `CORE_IAM_TENANT_OIDC_CLIENT_ID` e `CORE_IAM07D_FINE_FGA_STORE_ID`, além do leitor Keycloak. O store fino deve ter modelo `iam_capability` e grants/restrictive fences provisionados por operador; ausentes => DENY, nunca ALLOW.
- **G-1 continua PENDENTE:** write coverage completa implica dar suporte fino também às operações bloqueadas, CI integrado com Host principal e Service instalado, provider reconciliation, restore operacional e migração. Não anunciar produto funcional com multi-org só por existir uma rota claim funcional.

## TOPO-06B — saga de uma segunda Organization (operador confiável)

- `iam-org-provisioning-operator.ts` contém `OrganizationProvisioningSaga` e os adapters PG17 `PgOrgProvisionIntentStore` e `PgTenantOrganizationWriter`. Não é controller HTTP e não pode ser chamado pela UI ou por um Manager token.
- `control-iam-org-provision-intents.schema` é DDL Control **manual operador-only**, com reserva idempotente `request_id`, IDs tenant/org/workspace imutáveis, alias Keycloak determinístico, estados `reserved/reconcile_required/ready` e auditoria append-only. Runtime `syndes_core` não recebe acesso; operador precisa de role específica e autorização prévia.
- `KeycloakOrganizationWriter` usa Organizations Admin API 26.8.1 com client_credentials confidencial próprio, `GET organizations?search=<alias>` seguido de `POST` somente quando não existente e membership do fundador por UUID. Recupera a mesma Organization mesmo que o POST tenha sido confirmado e o cliente perca a resposta; conflito de alias/dados nega. A identidade fica EXCLUSIVAMENTE no Keycloak.
- Após provar fundador admin do tenant default e autorização externa de operador, a saga reserva intenção, garante Organization+membership Keycloak, executa INSERT atômico de Organization+workspace+membros+auditoria no tenant DB (somente após SQL002 físico removido no tenant), grava link 1:1 Control via operator CAS e só marca `ready` após checks atuais de KC/Control/tenant.
- Retry após `ready` NUNCA chama `ensureMember`, portanto revogação humana posterior não é desfeita por replay. Qualquer falha antes de `ready` exige reconciliação explícita, não abre autorização parcial.
- **Limites:** esta entrega implementa componentes de operador + schema candidato + testes, não instala roles em ambiente operacional, não cria cliente Keycloak admin/provisioner, não habilita endpoint de nova Organization e não elimina SQL002. G-3 só é aprovado com CI real de Keycloak + Control + tenant DB no mesmo fluxo, operador/installer separados, verificação de reprocessamento após queda e cleanup de recursos não reconciliáveis. `PRODUCTION_GATE=BLOCKED`.
