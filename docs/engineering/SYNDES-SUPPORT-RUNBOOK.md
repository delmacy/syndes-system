# Syndes Support — Runbook de instalação e governança
Estado: proposta para homologação, não autoriza execução em produção.

## Pré-requisitos inegociáveis
- PR #27 aprovada e integrada na linha de release (ou merge de Support revisado na linha funcional equivalente), CI verde, migrations dependentes CRM/Inbox/WhatsApp/Organizations instaladas; não alterar SQL 002 nem ativar multi-org (#31).
- Tenant operacional Syndes **dedicado**, status ativo e DB física confirmados no Control Plane. Não informar UUID comercial no Host. Definir exclusivamente via ambiente administrado `SYNDES_SUPPORT_TENANT_ID` e `SYNDES_SUPPORT_WHATSAPP_ACCOUNT_ID`; sem ambos o caminho externo nega, e sem o tenant todos negam.
- Keycloak deve ter cliente público *syndes-support-ui* com authorization code + PKCE S256, redirect URI exata no domínio **separado** da Central, sem token em storage persistente, JWKS/issuer/audience compatíveis com Core Host. O bundle do frontend **não possui runtime.json real**; publicar `support-runtime.json` por configuração de infraestrutura após validação. Não servir a UI na origem do Workspace/Platform Manager.
- OpenFGA: grants explícitos de `support:cases:internal` e/ou `support:cases:external` `can_read/can_write` conforme matriz. Sem grant automático para administrators ou solicitantes de outros tenants. Agentes externos devem ter ainda Inbox/read, CRM/read e membership de workspace válida.

## Grupos/filas: concessões administrativas
A migration cria filas **sem memberships**, pelo princípio da negação padrão. Não expor endpoint de gerenciamento de membros no MVP. Operador DBA autorizado aplica, após aprovação de acesso e usando a role designada do tenant Syndes:

```sql
BEGIN;
INSERT INTO support_queue_memberships
  (tenant_id,queue_code,principal_id,role,granted_by)
VALUES ('<TENANT_SYNDES_UUID>'::uuid,'it_infra','<KEYCLOAK_SUB>','agent','<OPERATOR_SUB>');
-- A trigger registra 'granted' na tabela support_queue_membership_audit.
COMMIT;
```

Revogação exige identidade de operador autenticada na sessão SQL (não permitir DELETE avulso):

```sql
BEGIN;
SELECT set_config('syndes.support_actor_id','<OPERATOR_SUB>',true);
DELETE FROM support_queue_memberships
 WHERE tenant_id='<TENANT_SYNDES_UUID>'::uuid
   AND queue_code='it_infra' AND principal_id='<KEYCLOAK_SUB>';
-- A trigger registra 'revoked'; UPDATE direta é rejeitada.
COMMIT;
```

Substituir os placeholders de exemplos **somente com valores verificados na operação autorizada**. Conferir quantidade afetada, autorização do operador, histórico e grants OpenFGA separadamente. Não provisionar memberships em banco comercial.

## Instalação e liberação
1. Rodar revisão independente de isolamento e evidências CI (unit, Host regressions, PostgreSQL real, E2E). O frontend exige validação contra runtime Keycloak e banco provisório.
2. Ensaiar backup/restore e rollback numa cópia descartável antes de migrar tenant real; migração `support/001_support_cases` é aditiva e reexecutável, mas não habilita automaticamente permissões.
3. Aprovar release imutável do Core Host com módulo confiável, manter SQL 002, emitir credenciais por mecanismo atual. Migrar **somente** o tenant Syndes pelo installer `infra/postgres/bootstrap/migrate-modules-tenant.sh` com id/digest autorizado. NÃO executar a migration diretamente no Control Plane nem nos tenants comerciais.
4. Prover `support-runtime.json` fora do código-fonte do frontend em origem dedicada; reverse proxy `/v1/tenants` para Host interno; no-cache config; CSP/HTTPS e nenhuma credencial em frontend.
5. Smoke autenticado e negativo: login, 401/403, cross-tenant, fila de TI vs Produto, agente externo e conta WhatsApp Syndes, nota nunca outbound, recuperação de ticket encerrado. Registrar aprovação de go-live.

## Rollback
Reverter imagem do Host e UI para o release imutável anterior, remover rota da UI do proxy. Não aplicar `DROP TABLE` nem apagar eventos/notes; dados são mantidos para correção ou retry. Falha de dados exigirá restore de backup validado mediante autorização e análise de impacto. NENHUM deploy automático a partir de push/PR.

## Monitoramento
Não ligar log de corpo de mensagens, contatos, tokens, secrets ou payloads de tickets. Reportar apenas status HTTP, erro por classe, latência, disponibilidade e eventos de autorização agregados sem identificadores pessoais. Contrato seguro de agregados para Platform Manager é **outra** issue; não reutilizar consultas de Case para isso.

## Gate adicional de migração — tenant exclusivo
O instalador genérico agora **pula** a migração Support para qualquer tenant diferente de `SYNDES_SUPPORT_TENANT_ID`; também pula se essa variável estiver ausente ou inválida. Para migrar o próprio tenant Syndes, o operador autorizado deve definir `TENANT_ID` e `SYNDES_SUPPORT_TENANT_ID` com a **mesma** UUID operacional previamente conferida no registry e executar o instalador habitual, mantendo `SYNDES_CORE_HOST_IMAGE` pinada. A liberação de SQL é testada em `tests/platform/support-migration-gate.test.sh`, executado na CI. O gate protege contra instalação acidental em tenants comerciais e **não** substitui a revisão do ID escolhido nem a autorização de mudança em produção.

## Gate de identidade separado para o Support
A conta pública `syndes-support-ui` deve estar provisionada em Keycloak operacional e a API deve exigir `azp` exato, **além** de `iss`, `aud`, `RS256`, `sub`, membership e OpenFGA. Não incluir clientes Workspace/Platform Manager na allowlist. O teste CI `support-browser-e2e` precisa comprovar que token Keycloak válido de outro cliente com mesma audience recebe 401. Nenhum cliente OIDC de produção deve habilitar password/direct grant usado exclusivamente pelo teste adversarial.
