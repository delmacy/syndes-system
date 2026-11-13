# I09 — Whatsmeow sidecar | Auditoria de fonte (2026-11-13)

**Base de leitura:** `main` SHA `8d17879b24fe3162f6b3e8a5776e25dd6d9cbc7b`. **Owner:** I09, componente técnico subordinado ao P03, não módulo de produto separado. Catálogo: `catalog/work-units.json`; documentação central: `docs/subprojects/P03-whatsapp`.

## Evidência de código, fronteiras e contratos

- `modules/whatsapp/gateway/whatsmeow/go.mod`: módulo Go `syndes/whatsmeow-sidecar`, Go 1.26.0, dependências `go.mau.fi/whatsmeow` e `pgx/v5`. Não há package.json na raiz do gateway Go; isso é esperado.
- `main.go`: `config`, `loadConfig`, `gateway` (interface interna), `newAccountHTTPHandler`, `authorizeAccount`, `accountToken`. Variáveis obrigatórias `WHATSAPP_STORE_DSN`, `SYNDES_API_URL`, `WHATSAPP_WHATSMEOW_TOKEN`, `WHATSAPP_WEBHOOK_TOKEN`; bind padrão `127.0.0.1:19083`.
- **HTTP interno declarado:** `GET /healthz` (sem autenticação, resposta `status: ok`), `POST /v1/accounts/{accountId}/{operation}` com `pairing`, `connect`, `disconnect`, `messages`. O endpoint de operação exige token derivado HMAC-SHA256 do master, tenant e account, comparado em tempo constante, com consulta ao registro de contas habilitadas. Não expor como API pública de produto. `/healthz` demonstra processo HTTP, não readiness de sessões, banco ou WhatsApp.
- `gateway.go`: `whatsmeowGateway`, `Pair`, `Connect`, `Disconnect`, `Pause`, `sendDirect`, `restore`, `enqueueInbound`, `startInboundDispatcher`, `deliverPending`, `callbackClient.deliver`. Adaptador Whatsmeow é implementação privada; contrato externo é via Host/HTTP/callback, não acesso direto à biblioteca.
- `outbound.go`: `Send` grava fila com chave de idempotência por conta; `startOutboundDispatcher` marca mensagens `processing` remanescentes como `failed` na recuperação; `deliverOutbound` reserva janela por conta com limite de 40/min, usa transação/lock e evita replay automático de resultado incerto. Esse limite existe no SQL do sidecar, mas não constitui teste de carga ou garantia de operação.
- **Callback:** `main_test.go` comprova contrato esperado de envelope `version=1`, `type=whatsapp.message.received`, headers `X-Syndes-Event-Version` e `X-Syndes-Event-Type`, tenantId/accountId e mensagem. Não confundir com o evento de plataforma `whatsapp.message.received.v2` no domínio P03, nem inferir que o novo projetor esteja ativo.

## Schemas e migrations

O `main.go` executa **DDL no startup** do sidecar, incluindo `sqlstore.Container.Upgrade`, `syndes_whatsapp_accounts`, migração condicional de `syndes_whatsapp_tenants`, `syndes_whatsapp_inbound_outbox` e índice único por conta/mensagem. `migrateOutbound` cria `syndes_whatsapp_outbound` e `syndes_whatsapp_send_windows`. **Fronteira importante:** armazenamento PostgreSQL dedicado a sessões/adaptador; não atribuir essas tabelas ao Control DB ou às migrations 001–008 do Tenant DB P03. Executar o binário pode alterar schema, portanto nenhuma execução foi realizada.

## Testes e evidência

`main_test.go` contém seis funções `Test*`: bearer, UUID, parse de destinatário, retry de callback, isolamento de tokens por conta/tenant e envelope versionado. **Não executados nesta auditoria.** Não foi validada cobertura de DDL, restauração de sessão, concorrência do limite 40/min, retomada de fila, falha de rede, isolamento real com PostgreSQL, nem integração com Host. O P03/STATUS registra **69 testes TypeScript locais em 2026-11-12** no checkout `b452a03e`, não testes Go nem CI desta SHA.

## Divergências documentais e riscos

1. `docs/subprojects/I09-whatsmeow-runtime/REFERENCIA-TECNICA.md` ainda apresenta classes, API e persistência como `A AUDITAR` ou não inventariadas; há evidência concreta de fonte para substituir esse texto após revisão editorial.
2. O DDL executado automaticamente no startup merece gate operacional explícito (backup, permissões, revisão de migração, rollback). **Não executar** para inspecionar.
3. `GET /healthz` não valida readiness de DB/sessão; não promover seu resultado a homologação.
4. O sidecar é componente do P03; nenhum frontend próprio ou API pública independente foi comprovado nos arquivos inspecionados.
5. Não foi comprovado que `I09` esteja implantado, que WhatsApp esteja conectado, que haja integração com Keycloak/FGA ou que os eventos do novo caminho estejam consumidos.

## Limites, estado e continuidade

Inspeção exclusivamente GitHub MCP de `catalog/work-units.json`, `AGENTS.md`, `main.go`, `gateway.go`, `outbound.go`, `main_test.go`, `go.mod`, `README.md`, `Dockerfile` (existência), `P03/STATUS.md`, `P03/REFERENCIA-TECNICA.md` e docs I09. Não foi realizado inventário exaustivo da árvore, comparação de todos os commits, leitura de todos os testes Go ou execução de CI. Não foram executados testes, runtime, SQL, migrations, deploy, workflows ou operações no DevServer. Não há evidência nova de homologação ou de Pages SHA.

**Próxima ação:** revisar arquivos restantes do sidecar, testes e adaptador do Host, comparar o contrato de callback P03; reconciliar referência I09/P03 em branch documental separada e passar por review antes de merge. Estado: **fonte parcialmente auditada; testes e operação não comprovados**.
