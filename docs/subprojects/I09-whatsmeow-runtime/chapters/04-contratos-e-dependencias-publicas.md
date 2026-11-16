## 4. Contratos e dependências públicas

> **Escopo de evidência:** inventário parcial da fonte no `main` `1cf48cc0a1281017ac58f7b9b9747f663109e151`, conforme [auditoria I09 de 15/11](https://github.com/delmacy/syndes-system/blob/audit/i09-callback-doc-drift-20261115-2055/docs/audits/I09-CALLBACK-DOCUMENTATION-DRIFT-20261115-2055.md). Declaração de código **não** equivale a contrato homologado, rota ativa, teste aprovado ou implantação.

### Entrada HTTP declarada
- `modules/whatsapp/src/inbound-http.ts` declara o controlador `@Controller("api/v1/internal/whatsapp/events")` e `@Post(":tenantId")`, correspondentes a `POST /api/v1/internal/whatsapp/events/:tenantId`.
- A auditoria identifica verificações declaradas de bearer, envelope, tenant e conta, e respostas 401/400/404/503. Esses códigos **não** são evidência de smoke test.
- `modules/whatsapp/src/plugin.ts` importa o módulo; `apps/core-host/config/modules.json` lista o plugin. Ainda falta provar o registro da rota no processo efetivamente executado e o comportamento ponta a ponta com Go/Inbox.

### Dependências e fronteiras
- I09 é componente técnico de **P03 WhatsApp**, não outro módulo de produto. O README P03 de 02/11 registra historicamente ausência do callback; essa afirmação não descreve a declaração de código observada em 15/11. A revisão normativa desse README pertence ao owner P03.
- `modules/whatsapp/gateway/whatsmeow/go.mod` é o manifesto Go identificado. Não inferir stack Node para o gateway pela ausência de `package.json` em sua raiz.
- O bridge transacional é opcional; a instância de store observada na auditoria não comprova uso do bridge. Não atribuir suas garantias ao receiver sem ensaio específico.
- O timer do dispatcher depende de `WHATSAPP_DISPATCH_ENABLED === "true"`; o valor operacional não foi verificado. Migrations tenant 001–008 declaradas pelo plugin não são prova de aplicação.

### Gates ainda abertos
- Confrontar handler Go e envelope v1; testar Node/Go isoladamente, inclusive negativos entre tenants, e registrar resultado/CI por SHA.
- Verificar configuração efetiva, registro da rota, integração, persistência e aceite por evidência independente. Consultar [STATUS](../STATUS.md), [EVOLUCAO](../EVOLUCAO.md) e [Referência técnica](../REFERENCIA-TECNICA.md).
- Bibliotecas permitidas, demais exports públicos, consumidores e compatibilidade permanecem **A INVENTARIAR**; não expor APIs privadas como contratos.
