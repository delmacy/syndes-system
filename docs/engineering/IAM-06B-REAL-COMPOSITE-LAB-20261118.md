# IAM-06B — Ensaio composto real descartável de decisão OpenFGA × Keycloak

**Data:** 2026-11-18. **Estado:** laboratório composto real validado — PR #167 CI 44277334326, **24/24 jobs**, merge `edd6e2c1c5aeaa0f278e3944d29af1b83336ed28`. **NÃO há integração a main.ts, runtime, bancos reais, policies operacionais ou deploy.**

## Contexto
IAM-04B/05B comprovou os adapters de vínculo e membership separadamente. IAM-06A foi integrado à main como comparador shadow isolado; OpenFGA permanece a única decisão efetiva. Este incremento exige, **para a mesma requisição de usuário**, provar a autenticação JWT real e as condições do Control Plane, banco tenant, Keycloak Organizations, OpenFGA e UMA.

## Laboratório e isolamento
- Reusa **exatamente** o job `keycloak-real-jwt` de `.github/workflows/platform-manager.yml`, acionado pela CI centralizada. Não cria workflow lateral nem novo realm persistente.
- Keycloak **26.8.1 descartável**, realm `syndes-iam-lab-ci`, somente 127.0.0.1:18088. O client UI direto com password grant existe só no CI; **não** propõe password grant no frontend real. JWT RS256, issuer HTTPS configurado, JWKS real, audience `syndes-core`, azp client `syndes-iam-lab-ui` e sub UUID.
- PostgreSQL **17-alpine descartável** 127.0.0.1:15432, database `syndes_control` e database separado `syndes_tenant_...`, escolhido pelo registro do servidor. `control-iam-org-links.schema` e esquemas de catálogo/lifecycle aplicados **somente** no container CI. `modules/organizations/sql/001_account_hierarchy.sql` e `002_legacy_single_context_gate.sql` aplicados integralmente no tenant descartável, com unicidade SQL preservada.
- O arquivo 003 de Organizations depende do schema legado de CRM/Inbox/WhatsApp e **não é aplicado integralmente** nesta prova. Apenas o DDL literal da tabela/index `platform_legacy_backfill_runs`, extraído de 003, é instalado para exercitar o resolvedor real. **Não alegar migration 003 completa ou cutover tenant.**
- FGA **v1.22.1 real, store in-memory descartável**, 127.0.0.1:18089, carregando `infra/security-access/fga-model.json` sem alterar modelos/tuples de produção. A porta real `FgaPermission` calcula os mesmos resource IDs a partir do tenant e recurso.
- Conta Keycloak confidential para membership usa `client_credentials`, segredo temporário de arquivo 0600 e roles read-only `view-users` + `view-organizations` na realm de CI; o token administrativo bootstrap é usado apenas para preparar a fixture e realizar o teste de revogação, **nunca como usuário de operação**.
- `IAM06B_DISPOSABLE_ONLY` e validação rígida de URLs/realm/IDs previnem execução acidental noutro ambiente; cleanup remove banco tenant, segredo temporário e containers CI.

## Matriz exercitada
1. Identidade assinada `ActorVerifier.verifyClient`, membership tenant real `PgMembership`, módulo instalado/ENABLED via `PgModuleCatalog` + `PgModuleLifecycle` + `PgEffectiveModuleAccess`, links reais `PgOrganizationIdentityLinks`, membership Keycloak `KeycloakOrganizationMembershipReader`, workspace/organization SQL `resolveSelectedOperationalScope`.
2. OpenFGA permite `inbox.conversation.read` e `inbox.message.send`; Keycloak UMA permite ambas; `Iam06ShadowComparePilot` registra concordância **coarse** sem mudar decisão.
3. Remover tuple FGA de leitura com UMA ainda permitindo: resultado **NEGAR**, categoria `legacy_coarse_fga_deny_uma_allow`.
4. SQL viewer tentando `message.send`, módulo suspenso, vínculo Control revogado, organização Keycloak revogada durante o mesmo bearer assinado: todos negam antes de FGA. UMA positivo isolado após revogação não equivale a admissão operacional.
5. Token de Platform Manager de outro issuer, usuário de outra Keycloak Organization, recurso/orig org divergente: nega. A tentativa de criar segunda org no mesmo tenant falha pelo SQL 002 com erro `23505`.
6. Falhas de rede/provedor e limites de concorrência/timeout do shadow seguem cobertas pela suíte unitária IAM-06A; não classificá-las como outages reais simuladas neste ensaio.

## Limites de validade
- Esta prova compõe adapters reais e SQL real em processo de teste, mas **não utiliza controllers HTTP, SSE, workers ou transações de efeito de negócio**. Os campos de instalação/receipt no Control são fixtures sintéticas e não prova física do instalador de release.
- Um provider de banco tenant do teste verifica `resolveRegistry` e `current_database` com conexão CI; **não** usa OpenBao, a role de produção `syndes_t_...` ou conexões operacionais. O adapter de owner do funil não é exercitado; não há comparação real de claim, transfer ou service.funnel.operate.
- A comparação coarse/UMA não prova paridade semântica. Claims de Organization e UMA não substituem memberships atuais nem ownership SQL. Não promover o esquema Control para produção nem remover o bloqueio multi-org.
- A conta service `view-organizations` lê Organizations no realm inteiro. Testar FGAP/menor privilégio por organização antes do Product Gate operacional.

## Aceite e próximas etapas
- CI `keycloak-real-jwt`: reconhecer explicitamente `IAM06B_REAL_JWT_CONTROL_PG17_TENANT_SQL002_OPENFGA_KEYCLOAK_PASS` e `IAM06B_REAL_FGA_DENY_UMA_ALLOW_AND_LIVE_REVOCATION_PASS`. Ambos os marcadores foram encontrados no log real do job `keycloak-real-jwt` da run 44277334326. A prova de laboratório foi APROVADA; **não homologada operacionalmente**.
- CI centralizada requer todas as regressões verdes, incluindo `host` e `infra`. PR só pode integrar main após aprovação.
- IAM-07: sessão SSE e concorrência real de requests, revogação durante efeitos SQL, latência p95, descontinuidade Keycloak/Control/PG/FGA, restauração e observabilidade.
- IAM-09: Product Gate, backup/restore, política de menor privilégio, rollback e revisão de service/event_delivery FGA separados (IAM-10). Até lá, **runtime OpenFGA inalterado**.

Rastreio: Issue #160, WBS IAM e PR deste incremento.

- Evidência: [PR #167](https://github.com/delmacy/syndes-system/pull/167), [CI 44277334326](https://github.com/delmacy/syndes-system/actions/runs/44277334326), [merge SHA](https://github.com/delmacy/syndes-system/commit/edd6e2c1c5aeaa0f278e3944d29af1b83336ed28). O runtime continua com OpenFGA; não aplicar schema manual no Control operacional.
