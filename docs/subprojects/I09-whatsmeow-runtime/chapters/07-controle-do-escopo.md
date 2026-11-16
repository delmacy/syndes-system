## 7. Controle do escopo
- Baseline: NÃO APROVADO.
- Alterações futuras: registrar impacto, dependências e aprovação antes de alterar o escopo.

## Fronteira documental do callback I09/P03 — auditoria 2026-11-15

- **Owner funcional:** P03 WhatsApp; I09 é componente técnico do gateway Go/Whatsmeow e mantém rastreabilidade histórica, sem constituir outro módulo de produto.
- **Divergência temporal:** a seção `Current audit (2026-11-02)` em `modules/whatsapp/README.md` registra ausência do receiver no recorte então inspecionado. Na main `1cf48cc0a1281017ac58f7b9b9747f663109e151`, a auditoria [I09-DOC-01](https://github.com/delmacy/syndes-system/blob/audit/i09-callback-doc-drift-20261115-2055/docs/audits/I09-CALLBACK-DOCUMENTATION-DRIFT-20261115-2055.md) identificou declaração do controlador `POST /api/v1/internal/whatsapp/events/:tenantId` em `modules/whatsapp/src/inbound-http.ts`. Não converter o relato histórico em afirmação de ausência atual.
- **Limite de evidência:** controlador declarado, import no plugin e allowlist não comprovam rota ativa, credenciais configuradas, integração Go/TS, migrações aplicadas, testes no SHA atual ou homologação. O timer do dispatcher depende de `WHATSAPP_DISPATCH_ENABLED === "true"`; seu valor operacional não foi verificado.
- **Fronteira de alteração:** a correção do README em `modules/whatsapp/README.md` e a decisão normativa de P03 exigem reconciliação pelo owner P03, preservando o histórico de 02/11. Esta nota I09 não altera contratos, requisitos aprovados ou status operacional.
- **Gate pendente:** cotejar fonte e documentação na SHA vigente, executar validações isoladas Node/Go e obter evidências de CI, ambiente e aceite antes de promover qualquer estado. Referência de acompanhamento: `I09.DOC.CALLBACK`, `I09.TEST.CALLBACK` e `I09.ACCEPT.01` em [EVOLUCAO](../EVOLUCAO.md).
