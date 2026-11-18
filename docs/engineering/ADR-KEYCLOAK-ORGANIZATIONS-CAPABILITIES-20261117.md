# ADR — Keycloak Organizations e Authorization Services como IAM do Syndes

**Data:** 2026-11-17. **Estado:** direção de produto aprovada para experimento controlado; **não é autorização de migração operacional**. Primeiro incremento implementa catálogo auditável e adaptador UMA isolado. **Nenhuma modificação** em realm, usuários, tokens, PostgreSQL operacional, OpenFGA, migrações, scripts de deploy ou UI.

## 1. Problema e decisão

O produto precisa conceder permissões por empresa, workspace e, quando justificável, funil: visualizar conversa, responder, assumir atendimento, transferir, operar funil. Manter a mesma concessão em Keycloak, SQL e OpenFGA gera divergência e duplicação de processos.

A **direção aprovada para avaliação** é:
- Keycloak (realm syndes) = autoridade canônica de conta de usuário, credenciais, federação, MFA, convites, vínculos com Keycloak Organizations, grupos e papéis organizacionais;
- Syndes Control Plane = autoridade canônica da conta contratante/tenant, banco escolhido pelo servidor, habilitação contratual de módulos, estados e billing;
- Syndes Tenant DB = autoridade de organização operacional (platform_organizations), workspace, unidade, funil, conversa, atribuição e regras transacionais de negócio;
- Keycloak Authorization Services = **candidato principal** para conceder permissões de ação por recurso organizacional (resource/scope/policy), com decisão no backend; a troca por OpenFGA exige um Product Gate separado;
- OpenFGA = continua **efetivo no runtime atual**, inclusive checks de usuário/serviço, até paridade real, revogação, isolamento e rollback validados. Grants de processamento de eventos por service principal NÃO são migrados neste incremento.

Não criar armazenamento paralelo de grants no PostgreSQL. O catálogo de capacidades diz **o que existe**, não **quem pode acessar**. A concessão fica em **uma** autoridade por classe de decisão, sob migração faseada.

## 2. Topologia

Realm syndes -> Keycloak Organization (empresa integrante de uma conta) <- associação imutável 1:1 -> (tenant_id, platform_organization_id) do Syndes -> Workspaces -> equipes / funis / dados. Um tenant pode ter N organizações, e a mesma identidade Keycloak pode integrar N organizações mediante convite e vínculos explícitos.

A estrutura do Syndes já existe em modules/organizations/sql/001_account_hierarchy.sql; a restrição física de SQL 002 ainda impede múltiplas orgs/workspaces operacionais no mesmo tenant. NÃO removê-la neste projeto e NÃO ativar multi-org para testar IAM. Fazer prova A/B em instâncias descartáveis com contratos já desenvolvidos.

Mapeamento proposto de criação de organização é uma futura tabela de vínculo auditada, com unicidade de (realm, keycloak_organization_id), (tenant_id, platform_organization_id), estado, revisão e reconciliação idempotente. **Sem DDL nesta etapa.** IDs de org não podem ser inferidos por displayName, domínio, CNPJ ou login. Remoção da org Keycloak e revogação de membership devem suspender o acesso no backend, nunca remapear para outra org automaticamente.

Keycloak Organizations gerencia pessoas e grupos organizacionais. **Limitação documentada do Keycloak 26.8.1:** grupos de Organization não podem ser referidos diretamente por Group Policies do Authorization Services; apenas realm groups. Portanto, grupo organizacional NÃO concede automaticamente permissão fina. Validar explicitamente alternativas: role/client role aprovada e escopada por recurso, política por usuário/recurso, ou validação server-side de membership com UMA; não usar role global de atendente como autorização para todas as organizações.

## 3. Catálogo versionado

Fonte inicial: catalog/iam-capabilities.v1.json. Estados distintos:
- declared_legacy: recurso/ação realmente **declarado no manifest do módulo**, mas NÃO garante rota operacional, cobertura universal, grant real, nem autorização fina equivalente;
- proposed: operação requerida pelo produto, ainda **não** separada como verificação própria no backend e **sem herança de read/write existente**.

Capabilities piloto: inbox.conversation.read, inbox.message.send, inbox.conversation.claim, inbox.conversation.transfer e service.funnel.operate. O manifesto histórico usa read/write em inbox:conversations, inbox:messages e inbox:assignment; assumir não pode ser igualado automaticamente a transferir. O recurso service:funnels não demonstra, por si, permissão para operar um funil específico. Aprovação por valor ou por solicitante é **regra transacional de negócio futura**, não conceder capability inexistente nem armazenar limites monetários em roles.

O catálogo torna-se fonte para tela de gestão e sincronizador futuro, com esquema, versão, nomes imutáveis, compatibilidade e processo de descontinuação. Nenhum job grava políticas Keycloak agora.

## 4. Desenho do Keycloak Authorization Services

- Criar no **laboratório isolado** um **resource server confidential** exclusivo (nome candidato syndes-policy-api), Authorization Enabled, policy enforcement Enforcing. Não converter clients públicos do browser (syndes-workspace-ui, syndes-crm-ui, syndes-inbox-ui) em servidores de política.
- Registrar apenas recursos de granularidade workspace e funil no piloto, com identificadores completos de tenant+org+workspace+funnel; nomes não são privilégios nem contêm dados sensíveis.
- Escopos por capability, nunca confiar em scopes OIDC de login como grant de negócio.
- Adaptador experimental apps/core-host/src/keycloak-authorization-pilot.ts usa UMA ticket no token endpoint com **token de acesso humano já validado pelo Host**, audience do resource server, permission exata RESOURCE#SCOPE, response_mode=decision, sem submeter solicitações nem logar tokens. 403/false negam; erro, timeout ou formato inesperado falham fechado. **Esse adapter não é importado por main.ts nem pelo AuthorizationPort operacional.**
- A interface atual AuthorizationPort conhece só actor.id/tenant/resource/action, insuficiente para a avaliação UMA on-behalf-of. Antes da integração, desenhar contrato de ator verificado/token efêmero e o contexto organization/workspace/funil, restringir encaminhamento do token ao backend trusted, sem gravá-lo em logs/cache. Não criar um bypass ou usar service account como substituta do usuário.
- O Syndes continua responsável por autenticação de bearer no Host (issuer/aud/azp), membership e estado do tenant, estado habilitado do módulo, membership/estado de org e workspace, atribuição de recursos e predicados SQL. Nem uma decisão UMA positiva pode selecionar DB arbitrário ou ignorar essas verificações.

## 5. Segurança, revogação e UX

- Política deny-by-default, ações específicas, escopo imutável e auditoria. Sem papel de administrador global com leitura implícita de CRM/Inbox. Testar usuario A em org A e B, usuário em dois tenants, workspace A/B, funil vendas/financeiro, viewer vs operador, login errado, cache/SSE, revogação de membro e role, 403/500/timeout.
- Claims organization no JWT e Keycloak roles **não são concessões operacionais suficientes**; o SQL valida os vínculos efetivos, inclusive dados da conversa/funil. Revogação imediata depende de verificação atual no backend, não exclusivamente de JWT pré-existente. Provar SLA de revogação com sessão aberta, SSE e requisições concorrentes.
- Delegação via interface Syndes somente após endpoints autenticados, menos privilégio, audit trail, idempotência, autorizações de quem delega, reconciliação e rollback. Nunca entregar senha de admin Keycloak ao browser.
- Provisionamento e política Keycloak exigem service account restrita ou workflow operador, TLS/Tailnet privado, sigilos, zero default password e backup/restauração. Não habilitar Organizations no realm syndes até ensaio e comparação de UX/login PKCE.

## 6. Implantação e decisão de retirada do OpenFGA

Fases: inventário+catalogação -> prova UMA sem runtime -> laboratório Keycloak descartável com duas orgs, dois usuários, dois workspaces e dois funis -> adapter trusted para OIDC real -> modo shadow sem mudança de decisão -> negações/revogação e performance -> Product Gate com restore e rollback -> migração gradual de classes humanas -> revisão específica de service/event grants. NUNCA remover OpenFGA por conveniência antes da paridade verificada.

**Critério comercial:** o MVP continua CRM -> Inbox -> WhatsApp -> Serviço Básico. Não criar produto IAM/marketplace genérico nem novas telas fictícias agora.

## 7. Referências

- Keycloak 26.8.1 Authorization Services: https://www.keycloak.org/docs/26.8.1/authorization_services/
- Keycloak 26.8.1 Organizations e restrição de grupos nas políticas: https://www.keycloak.org/docs/26.8.1/server_admin/
- Contrato Syndes atual: packages/core-kernel/src/contracts.ts, apps/core-host/src/adapters.ts, infra/security-access/fga-model.json
- Topologia e gates: docs/engineering/ADR-ACCOUNT-ORGANIZATION-UNIT-WORKSPACE-PROPOSAL.md, docs/engineering/ORG-WORKSPACE-ACCEPTANCE.md.
