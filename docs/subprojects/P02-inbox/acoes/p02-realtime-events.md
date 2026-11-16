# P02 Inbox · Acompanhar alterações por SSE · `p02-realtime-events`

> **Ficha de ação · template v1.0.0 congelado · 16/11/2026.** Código identificado na SHA `24018b354392`; **não equivale a requisito aprovado, teste executado, integração ativa, deploy ou homologação**. Requisitos: [ESCOPO](../ESCOPO.md), evidências: [STATUS](../STATUS.md).

## A. Identidade e estado

| Campo | Referência |
|---|---|
| Owner | P02 `modules/inbox` |
| Função | `observabilidade`, [matriz](../MATRIZ-ACOES.md) |
| ID estável | `p02-realtime-events` |
| Estado do código | DECLARADO NO CÓDIGO |
| Testes | 34 PASS históricos na auditoria 12/11; **não reexecutados nesta ficha** |
| Integração/implantação/aceite | **NÃO HOMOLOGADOS** |
| Novo requisito autorizado | NENHUM |

## B. Intenção e regra do domínio

**História descritiva, não aprovada como novo requisito:** como operador ou serviço devidamente autorizado, quero **acompanhar alterações por sse**, respeitando tenant, organização, workspace e as fronteiras de outros owners.

**Regra encontrada:** changed sem PII; até 60 listeners; stream 60s; recheck periódico no modo enforce; fallback HTTP.

## C. Fluxo e edge cases

**Implementação exata:** SSE usa listeners em memória de um Host; evento `changed` não transporta PII, expiração em 60s, heartbeat a cada 15s e revalidação periódica apenas no modo `enforce`. Não equivale a Event Bus persistido.

[Confronto de código, owners e decisões](../PARIDADE-CODIGO.md).

1. Conferir identidade e contexto confiáveis antes de executar o método HTTP.
2. Validar entrada e autorização segundo o código e contratos versionados.
3. Executar `InboxHost.revalidateStream → InboxChangeBus.connect` somente no contexto permitido.
4. Observar persistência, idempotência, auditoria e notificação, quando aplicáveis.

**Exceções propostas (NÃO são testes PASS):**

- **EC-01** — 61ª conexão 429.
- **EC-02** — token revogado.
- **EC-03** — membership removida.
- **EC-04** — múltiplos Hosts sem broker.

Consultar [diagramas](../DIAGRAMAS.md) como modelo de código, não evidência operacional.

## D. Contratos, métodos e APIs

| Campo | Descrição |
|---|---|
| Método e endpoint | `GET /v1/tenants/:tenantId/inbox/events` |
| Método | `InboxHost.revalidateStream → InboxChangeBus.connect` |
| Entrada | `Bearer JWT; escopo confiável` |
| Permissão/contexto | `inbox:conversations/read` |
| Fonte | [`src/inbox.controller.ts`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/inbox.controller.ts) |

O endpoint declarado não está necessariamente disponível em um Host configurado, e método interno não é automaticamente um contrato público exportado.

## E. Dados e integridade

**Objetos relacionados:** `nenhuma persistência própria; invalidação SSE em memória`. [SQL 001](<https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/sql/001_inbox_foundation.sql>) define a base do domínio; alterações posteriores em campos de WhatsApp, organização e workspace são dependentes de outras migrations, **sem prova de aplicação**. Não atribuir tabelas CRM/WhatsApp ao Inbox. Ver [inventário](../INVENTARIO-TECNICO.md).

## F. Segurança e isolamento

| Condição | Teste a comprovar |
|---|---|
| Ausência de JWT HTTP | 401, se existe endpoint |
| Negação FGA/membership | 403 antes de exposição ou escrita |
| Parâmetros inválidos | 400 quando apropriado |
| Registro inexistente / conflito | 404 / 409 conforme método concreto |
| Tenant DB divergente / falha | 503 ou fail-closed |
| Tenant A/B / workspace alheio | Nunca ler, alterar ou notificar outro escopo |
| `legacy|enforce` / multi-org | Gates e índice de backfill exigem teste real |

Ver [`src/context-guard.ts`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/context-guard.ts) e [`src/inbox.controller.ts`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/inbox.controller.ts). A tabela é uma **matriz de riscos**, não uma promessa de todos os status para esta ação.

## G. Frontend e estados visuais

UI de referência: `apps/workspace-web/src/features/inbox.tsx`, além dos assets antigos `modules/inbox/public`. Para ação com tela, validar estados vazio/carregando/erro, acessibilidade, mobile, conflito, idempotência e grants. **Consumidor de evento não exige tela independente.** Manager não tem acesso a tenant por seu papel.

## H. Eventos e dependências

Rotas dependem de Host, Kernel, FGA, Tenant DB e, quando pertinente, ports CRM e WhatsApp. Mudanças de estado podem invalidar SSE scoped em um Host; não é broker distribuído.

## I. Testes e casos Given/When/Then

Arquivos relacionados à investigação: [`test/inbox.test.mjs`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/test/inbox.test.mjs) · [`test/default-context.test.mjs`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/test/default-context.test.mjs) · [`test/frontend.test.mjs`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/test/frontend.test.mjs). **A presença não comprova cobertura individual.**

| Proposta | Dado | Quando | Então a verificar |
|---|---|---|---|
| CP-01 | Identidade e escopo válidos | Executa a ação | Contrato e dados preservados |
| CP-02 | Principal sem grant | Requisita/consome | Falha segura e sem mutação |
| CP-03 | Recurso tenant B | A tenta operar B | Rejeição completa |
| CP-04 | 61ª conexão 429 | Reproduz exceção | Tratamento do método documentado |

**`cd modules/inbox && npm test` não foi executado nesta edição.** E2E com Keycloak/OpenFGA reais, restore e Product Gate continuam pendentes.

## J. Decisões e handoff

**Nenhuma decisão nova aprovada.** Agente deve ler [Ficha Mestre](../FICHA-MODULO.md), [Matriz](../MATRIZ-ACOES.md), [STATUS](../STATUS.md), `AGENTS.md`, contrato/código na SHA atual, e propor testes antes de alterar runtime. Só implementar após autorização com paths e critério de aceite; atualizar código, documentação, WBS e testes no mesmo incremento.

[Voltar às ações](../MATRIZ-ACOES.md) · [Ficha Mestre](../FICHA-MODULO.md).
