# P02 Inbox · Responder à conversa · `p02-message-reply`

> **Ficha por ação · v1.0.0 congelada · 16/11/2026.** Evidência do código na SHA `24018b354392196899332af1581170fb3ad7cf24`. **DECLARADO NO CÓDIGO não significa testado, integrado, implantado ou homologado**. A [especificação](../ESCOPO.md) está em rascunho, sem aprovação de novo requisito.

## A. Endereço e estado

| Campo | Referência |
|---|---|
| Owner | P02 · `modules/inbox` |
| Função | `mensagens` · [matriz](../MATRIZ-ACOES.md) |
| Ação estável | `p02-message-reply` |
| Natureza | HTTP autenticado |
| Código | **IDENTIFICADO**, SHA `24018b354392` |
| Testes | Arquivos relacionados; **NÃO REEXECUTADOS** nesta ficha; 34 PASS históricos em 12/11 |
| Integração/ambiente/aceite | **NÃO HOMOLOGADOS**; ver [STATUS](../STATUS.md) |
| Autorização de nova implementação | **NENHUMA** |

## B. Intenção, ator e fronteira

**Caso de uso descritivo (não normativo):** operador autorizado ou serviço interessado precisa **responder à conversa** dentro do escopo confiável de tenant, organização e workspace.

**Limite de ownership:** Inbox possui conversa, mensagens e suas transições; CRM possui Person; WhatsApp possui conta/roteamento/provider; P05 possui funil/protocolo. Não atravessar esses limites por simples dependência.

**Regra encontrada no código:** resposta simulation é local; WhatsApp usa port opcional/queue com gate, não entrega imediata confirmada.

## C. Fluxo, variações e exceções

1. Resolver a identidade e o escopo por fonte confiável no Host antes da operação.
2. Aplicar o contrato de permissão e validação: `inbox:messages/write`.
3. Executar `InboxHost.reply → InboxService.reply ou WhatsAppReply.enqueue` ou rejeitar com falha segura.
4. Confirmar o resultado no recurso do tenant; atualizar/invalidação de UI **somente quando houver mutação bem-sucedida** e caminho configurado.

**Edge cases candidatos (a validar com código/teste, NÃO PASS):**

- **EC-01** — WhatsApp adapter ausente 503.
- **EC-02** — conversa resolvida ou bot.
- **EC-03** — não atribuído.
- **EC-04** — provider offline.
- **EC-05** — grant negado.

Diagrama relacionado: [arquitetura e sequência](../DIAGRAMAS.md). Não inferir implementação operacional do desenho.

## D. Contrato, parâmetros e API

**Entrada declarada:** `body texto até 5000`.

**Contrato:** `POST /v1/tenants/:tenantId/inbox/conversations/:id/replies`.

**Símbolo principal:** `InboxHost.reply → InboxService.reply ou WhatsAppReply.enqueue`; source: [controller](<https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/inbox.controller.ts>) · [service](<https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/service.ts>) · [repository](<https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/postgres.ts>).

**Permissão ou contexto de referência:** `inbox:messages/write`. Confirme grants efetivos em OpenFGA por ambiente; o recurso no código não cria relacionamento autorizado automaticamente.

## E. Dados e integridade

**Entidades tocadas:** `inbox_messages para canal local; outbox WhatsApp sob owner P03`. As tabelas base estão em [SQL 001](<https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/sql/001_inbox_foundation.sql>); extensões `platform_*`, marcadores WA e colunas de UI foram introduzidas em etapas/migrations externas ao arquivo 001 e exigem rastreabilidade de versão/aplicação.

**Regra de segurança:** nunca selecionar banco de tenant por parâmetro externo; não atribuir tabelas `crm_*` ou `whatsapp_*` ao owner Inbox. Fonte detalhada: [INVENTARIO-TECNICO](../INVENTARIO-TECNICO.md).

## F. Segurança, erros e isolamento

| Cenário | Critério verificável |
|---|---|
| JWT HTTP | 401 para ausência/invalidez, quando há endpoint |
| Membership / FGA | 403 antes de operação não autorizada |
| Recurso inexistente | 404 quando o handler indica ausência |
| Validação | 400; conflitos de integridade/idempotência podem gerar 409 |
| Banco confiável divergente ou infra falha | 503 / fail-closed quando aplicável |
| Tenant A → B / workspace externo | Nenhuma leitura, escrita, notificação ou vínculo cruzado |
| Multi-org / módulo ENABLED | Condicionado a `SYNDES_MULTI_ORG_ENABLED` e modo `legacy|enforce`; **não homologado** |

Os códigos acima são **mapa de risco**, não uma alegação de que todos se aplicam a esta operação: [controller](<https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/inbox.controller.ts>) e [guard](<https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/context-guard.ts>).

## G. Interface e experiência

Consumidor visual de referência: `apps/workspace-web/src/features/inbox.tsx`; assets legados `modules/inbox/public`. **A presença de controle visual não comprova a rota autenticada ou integração real.** Verificar quando pertinente: estado de fila vazia, loading, resposta de erro, autorização, retorno após retry, mobile e teclado. A ação assíncrona não exige uma tela própria.

## H. Eventos, dependências e efeitos colaterais

Mudanças em conversa/mensagem podem emitir invalidação SSE scoped em memória; para WhatsApp a entrega e o histórico dependem do port opcional do P03. A recepção externa depende de consumidores/worker opt-in.

## I. Testes Given/When/Then e evidências

**Arquivos relacionados para inspeção (não equivalem a PASS desta ação):**

- [`modules/inbox/test/inbox.test.mjs`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/test/inbox.test.mjs) — arquivo relacionado, **cobertura desta ação não auditada**
- [`modules/inbox/test/frontend.test.mjs`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/test/frontend.test.mjs) — arquivo relacionado, **cobertura desta ação não auditada**

| Caso proposto | Dado | Quando | Então a comprovar |
|---|---|---|---|
| CP-01 | Identidade e contexto autorizados | Responder à conversa | Contrato e efeito corretos no escopo |
| CP-02 | Membership/grant ausente | Requisita a ação | Negação antes de acesso ou mutação indevida |
| CP-03 | Recurso de outro tenant/workspace | Operador do tenant A executa | Nenhum dado ou efeito cruzado |
| CP-04 | WhatsApp adapter ausente 503 | Reproduz edge case | Rejeição, conflito ou revisão conforme contrato real |

**Comando de fonte:** `cd modules/inbox && npm test`, **não executado nesta edição documental**. CI verde e browser mockado não são E2E real Keycloak/FGA + PostgreSQL tenant A/B.

## J. Decisões, handoff e checklist do agente

**Requisito novo aprovado:** **NENHUM**. Esta ficha apenas torna rastreáveis as superfícies existentes.

**Para planejar:** ler [Ficha Mestre](../FICHA-MODULO.md), [Matriz](../MATRIZ-ACOES.md), [STATUS](../STATUS.md), `AGENTS.md`, código na SHA atual, dependências e edge cases; apresentar WBS, riscos e testes sem implementar.

**Para implementar:** somente mediante decisão/autorização explícita; editar caminhos do owner, cobrir negativos e atualizar contratos/diagramas/WBS/ficha/STATUS. Registrar commit, PASS/FAIL/SKIP, ambiente e prova de Product Gate separadamente.

[Voltar ao índice de ações](../MATRIZ-ACOES.md) · [Ficha Mestre](../FICHA-MODULO.md) · [Fontes técnicas](../INVENTARIO-TECNICO.md).
