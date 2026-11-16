# I09 — Whatsmeow runtime | STATUS

> Documentação-base, SEM AUDITORIA FUNCIONAL. Ver ESCOPO.md e SPRINT.md nesta pasta.

## Onde paramos?
- Estrutura documental criada; maturidade operacional não verificada.
- Fonte rastreável: modules/whatsapp/gateway

## Para onde vamos?
- Revisar escopo e contratos do próprio módulo; aprovar primeiro incremento.

## WBS e capabilities
| ID | Estado | Evidência | Próxima etapa |
|---|---|---|---|
| I09.DOC.01 | PENDENTE DE REVISÃO | Catálogo da unidade | Inventariar requisitos |

## Dependências e bloqueios
- A INVENTARIAR com contratos públicos, distinguindo dependências obrigatórias e opcionais.

## Checkpoints
| Data | Resultado | SHA / CI / ambiente | Continuidade |
|---|---|---|---|
| 2026-11-12 | Estrutura documental inicial | Não constitui evidência operacional | Revisar o escopo |

## Auditoria parcial — callback interno (15/11/2026)
- Evidência: [I09 callback/documentation drift](https://github.com/delmacy/syndes-system/blob/audit/i09-callback-doc-drift-20261115-2055/docs/audits/I09-CALLBACK-DOCUMENTATION-DRIFT-20261115-2055.md) na branch de auditoria `audit/i09-callback-doc-drift-20261115-2055` (não integrada à main nesta revisão). A seção de 02/11 do README P03 é histórica: a main `1cf48cc0` já declara `@Controller("api/v1/internal/whatsapp/events")` e `@Post(":tenantId")` em `modules/whatsapp/src/inbound-http.ts`, importados pelo plugin. Não usar a alegação antiga de ausência como diagnóstico atual.
- **Estado:** fonte parcialmente auditada; declaração de rota não comprova registro em runtime, segredo, migrações, integração Go/Inbox, testes atuais, deploy ou homologação. `WHATSAPP_DISPATCH_ENABLED === "true"` condiciona o timer do worker; configuração operacional não verificada.
- **Próximo gate:** confrontar handler Go e envelope v1, executar testes isolados Node/Go e negativos entre tenants, registrar CI por SHA e verificar integração somente mediante evidência. Não extrapolar os 69 testes Node históricos de `b452a03e` para o SHA atual.

## Rastreabilidade dos gates I09/P03 (revisão documental 16/11/2026)
- Os cinco marcadores `I09.DOC.CALLBACK`, `I09.TEST.CALLBACK`, `I09.OP.DISPATCH`, `I09.DATA.BRIDGE` e `I09.ACCEPT.01` estão descritos em [EVOLUCAO.md](EVOLUCAO.md), com evidências e pendências individualizadas. São **gates documentais de acompanhamento**, não novos requisitos aprovados nem cinco testes executados.
- **WBS mestre:** `50.05` (homologação gateway/Whatsmeow), `50.06` (rate limit/integridade/quotas) e `95.05` (ensaios de falha/DR) permanecem com os estados **BLOQ** registrados na [WBS histórica](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md); consultar a fonte atual antes de qualquer mudança de estado.
- **Owner:** I09 é componente técnico do P03; a correção normativa do README P03 deve ser conciliada pelo proprietário P03, preservando a afirmação como registro histórico de 02/11. Não há evidência de aprovação de escopo, execução do dispatcher, CI atual, deploy ou aceite.
