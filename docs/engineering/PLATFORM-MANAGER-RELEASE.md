# Syndes Platform Manager — implantação e validação

Data: 2026-11-09. Estado: desenvolvimento/homologação bloqueada. Não é registro de deploy.

## Pré-requisitos obrigatórios

1. Revisar e aprovar PRD/WBS e ADR de isolamento, com base integrada correta e CI verde. Nenhum merge/deploy somente por build local.
2. Criar cliente **público** Keycloak OIDC próprio (referência: syndes-master-admin), Authorization Code + PKCE S256, sem implicit flow nem senha no navegador; redirect URI exato HTTPS da origem exclusiva (raiz /), web origins estritas. Configurar audience dedicada da API (referência: syndes-master-api). Confirmar issuer, azp, audience em JWT real sem registrar ou colar tokens em logs.
3. Criar role syndes_master_api por infra/postgres/bootstrap/control-admin.schema **somente no syndes_control**, após control.schema e tenant_registry. Usar provisionador de segredos autenticado para credencial específica. Configurar role sem superuser/CREATEDB/CREATEROLE, apenas SELECT nas quatro tabelas de metadados. Revisar grants de CONNECT de todas as bases: tenant e bancos de serviço precisam revogar PUBLIC; separar por rede, não compartilhar credenciais.
4. Fazer bootstrap auditado do primeiro owner com sub imutável Keycloak em platform_operator_access. Não adotar e-mail, membership, nem roles de cliente como concessão. Provisionamento de novos operadores fica fora do MVP e requer workflow privilegiado com trilha de auditoria.
5. Criar e manter fora do Git: MASTER_API_ENV_FILE (MASTER_KEYCLOAK_ISSUER, _AUDIENCE, _CLIENT_ID, _JWKS_URL, MASTER_PUBLIC_ORIGIN, MASTER_CONTROL_DB_URL_FILE=/run/secrets/master_db_url), MASTER_DB_URL_FILE e MASTER_RUNTIME_JSON (issuer, clientId). Segredos no OpenBao e arquivo apenas com permissões necessárias ao UID do processo.
6. Antes de subir qualquer serviço do Manager, provisionar as redes internas dedicadas `syndes-master-data` e `syndes-master-identity` (`docker network create --internal` se inexistentes). Anexar **somente PostgreSQL** na primeira e **somente Keycloak** na segunda, pelas alterações de Compose versionadas, em rollout aprovado de cada stack. Manager API anexa-se apenas a `master-private`, `syndes-master-data` e `syndes-master-identity`; frontend apenas a `master-private` com bind 127.0.0.1. Core Host/Whatsmeow/OpenFGA não podem compartilhar essas redes. Validar rede real no alvo, firewall, resolução DNS, TLS HTTPS privado (Tailnet) e impossibilidade de conexão ao Core Host. PostgreSQL permanece fisicamente compartilhado entre DBs no mesmo servidor: negar CONNECT tenant com role mínima, além da segmentação de rede.
7. NÃO fazer deploy com a trava SQL 002 removida, nem alterar tenant real, nem juntar este trabalho com o pipeline de release da issue #31 sem revisão específica.

## Gate de testes

- Novo frontend: build + unit/contract + browser E2E com fixtures identificadas.
- API: auth Keycloak RS256, audience, azp, principal, grant, rotas e negativas. Há teste CI com tokens **realmente emitidos por Keycloak descartável** (client OIDC Master, Workspace mal configurado com mesma audience, client sem audience, principal sem grant). O grant `password` habilitado nesse realm é **exclusivamente uma fixture de CI**, proibido nos clients públicos de produção, onde usar Authorization Code + PKCE.
- Core Host: negar azp do Platform Manager mesmo se token de audiência ampla; testar com e sem variável opcional.
- PostgreSQL: executar testes/platform/platform-manager-postgres-smoke.sh em container descartável (CI), inclusive SELECT Control DB, negar DML e negar CONNECT a banco tenant. Repetir migração/admin schema para verificar idempotência.
- Regressão: suites CRM, Inbox, WhatsApp, Organizations, Core Host, Workspace e kernel; controles de qualidade anteriores intocados.
- Containerização: duas builds independentes, Compose válido, healthcheck das duas aplicações e usuário DB least-privilege.
- Homologação REAL: navegador com Keycloak e token real, consulta ao Control DB e diretório real, TLS, 401/403 cruzados, grant ativo/revogado, role DB, rede e rollback.
- Screen captures de homologação devem vir de aplicação efetivamente implantada, sem dados falsos; screenshots do E2E são nomeados FIXTURE e **não comprovam implantação**.

## Comandos de validação (não executar em produção sem autorização)

- No win1-server, em cada app: npm ci; npm test; npm run build.
- E2E: em apps/master-admin-web, npm run build e npm run test:browser.
- Em CI isolado com Docker: bash tests/platform/platform-manager-postgres-smoke.sh; docker build de ambos Dockerfiles; docker compose config --quiet com **placeholders de CI**, sem credenciais reais.
- Para investigação de publicação autorizada: curl -fsS https://<origem-privada>/ e GET /v1/platform/admin/me sem Authorization deve retornar 401. Repetir com grants e tokens reais sem registrar os tokens. Verificar IP/Tailnet e certificados no proxy.
- Rollback: reverter apenas versões/stack do Manager, preservando schema aditivo e dados do Control DB; não reiniciar/alterar Core Host nem migrar bancos tenant sem seu plano específico. Registrar evidência e operador.

## Registro de tarefas WBS (evidência local inicial)

| WBS | Arquivos principais | Evidência | Estado |
| --- | --- | --- | --- |
| 1.0 | branch local, diff, scripts | win1-server contém mudanças não commitadas preexistentes; baseline | auditado |
| 2.0 | PRD/WBS, ADR | contratos, matriz e fronteiras versionáveis | documentado |
| 3.0 | auth.mjs, adapters.ts, control-admin.schema | token JWT cruzado, autorização por sub, role mínima | código + testes locais; DB/Keycloak reais pendentes |
| 4.0 | server.mjs, routes.test.mjs | somente GET, SQL parametrizado, DTOs de metadados | testes locais aprovados; DB real pendente |
| 5.0 | App.tsx, auth.ts, api.ts, tests | sem menus futuros; recentes próprios; detalhe API; E2E de fixture | build, unitários e navegador local aprovados |
| 6.0 | workflows/platform-manager.yml, postgres-smoke.sh | QA e CI novo | teste PostgreSQL e pipeline remoto pendentes |
| 7.0 | Dockerfiles, compose.yaml | builds, segredos, healthcheck, redes | configuração escrita; deploy/HTTPS não executados |
| 8.0 | roadmap | ações futuras bloqueadas | fora do MVP |

**Definição de conclusão:** nenhum item é marcado 'implantado' ou 'operacional' até homologação real e CI verde. Pendente: owner bootstrap auditado, configuração Keycloak/OpenBao, teste PostgreSQL real, CI da PR, validação das redes e HTTPS, prints reais, aprovação de Product Gate de release.
