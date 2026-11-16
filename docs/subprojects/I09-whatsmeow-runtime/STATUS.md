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
