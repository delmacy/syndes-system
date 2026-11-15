# I09 / P03 — callback e estado documental (2026-11-15)

## Baseline e fronteiras
- GitHub main: `1cf48cc0a1281017ac58f7b9b9747f663109e151`; branch de auditoria isolada.
- I09 é o componente técnico Go/Whatsmeow do P03, não um produto separado. Catálogo: `I09 -> modules/whatsapp/gateway`, `documentationParent=P03`.
- Fontes inspecionadas: `modules/whatsapp/README.md`, `modules/whatsapp/src/inbound-http.ts`, `modules/whatsapp/src/dispatch-worker.ts`, `modules/whatsapp/src/plugin.ts`, `modules/whatsapp/package.json`, `modules/whatsapp/gateway/whatsmeow/go.mod`, `apps/core-host/config/modules.json`, `docs/subprojects/{I09-whatsmeow-runtime,P03-whatsapp}/STATUS.md` e referência técnica I09.
- Não foram inspecionados todos os arquivos Go, handlers, testes e migrations; não extrapolar para a árvore inteira.

## Achado I09-DOC-01 — histórico do callback sem delimitação temporal
- `modules/whatsapp/README.md`, seção “Current audit (2026-11-02)”, afirma que `POST /api/v1/internal/whatsapp/events/{tenantId}` não existe nas fontes Core Host/Inbox então examinadas. A seção “Versioned inbound event contract” ainda diz que nenhum receiver novo foi habilitado.
- Na main auditada, `modules/whatsapp/src/inbound-http.ts` **declara** `@Controller("api/v1/internal/whatsapp/events")` e `@Post(":tenantId")`; verifica bearer configurado, envelope e tenant/account, e grava evento no tenant DB. `src/plugin.ts` importa `WhatsAppInboundHttpModule`; `apps/core-host/config/modules.json` lista `@syndes/whatsapp/plugin`.
- A afirmação histórica não pode ser usada como diagnóstico atual de **ausência de implementação**. A documentação deve explicitar que é baseline histórico e apontar para o receiver atual. Declaração de rota/import/allowlist **não prova** rota registrada em runtime, segredo configurado, migrations aplicadas, integração ponta a ponta ou homologação.
- `src/inbound-http.ts` escolhe o caminho transacional apenas quando um bridge é injetado; o serviço Nest mostrado instancia o store sem esse bridge. Assim, o caminho textual legado é o padrão nessa composição inspecionada. Requer teste de integração antes de atribuir garantias transacionais do bridge ao receiver ativo.
- `src/dispatch-worker.ts` só inicia o timer quando `WHATSAPP_DISPATCH_ENABLED === "true"`; nenhum valor operacional foi consultado.

## Contratos e evidências
- Contrato público HTTP declarado: callback interno POST com token bearer e validação de envelope; erros explícitos 401/400/404/503. Não confundir com endpoint humano nem assumir exposição pública.
- Contratos privados: `WhatsAppInboundStore`, `WhatsAppInboundService`, `WhatsAppDispatchWorker`; dependências de tenant DB confiável, registry, Inbox e gateway.
- Eventos: envelope inbound de WhatsApp e projeção Inbox; compatibilidade Go/TS não testada nesta rodada.
- Persistência: plugin declara migrations tenant WhatsApp 001–008; nenhuma aplicação de SQL ou schema operacional verificada. O `go.mod` real está em `gateway/whatsmeow/go.mod`, não diretamente em `gateway/go.mod`.
- Testes: P03 STATUS relata 69 testes Node aprovados em checkout anterior `b452a03e`, **não** na main atual; Go não executado. Nenhum teste ou CI executado/confirmado nesta rodada.
- Runtime/deploy/aceite: não inspecionados. Nenhuma evidência de homologação ou GitHub Pages SHA.

## Continuidade
1. Reconciliar a seção histórica do README P03 e a referência I09 sem apagar o histórico; atribuir owner documental correto.
2. Auditar handlers Go reais, versão do envelope, testes Go/Node e compatibilidade do callback; comprovar via testes isolados e CI por SHA, quando autorizados.
3. Reconciliar 57 unidades mais owners adicionais, review gates e Pages SHA em trabalho global próprio. Divergências globais **não** estão zeradas.

Somente documentação nesta branch; sem merge, testes, runtime, SQL, migrations, segredos, workflow, deploy ou DevServer01.
