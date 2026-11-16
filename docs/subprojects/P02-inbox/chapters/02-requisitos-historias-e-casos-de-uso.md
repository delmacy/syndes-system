## 2. Requisitos, histórias e casos de uso — inventário descritivo

> **Atualização técnica 16/11/2026.** O [ESCOPO](../ESCOPO.md) continua **RASCUNHO NÃO APROVADO**. Os UC/US abaixo descrevem **comportamentos encontrados no código**, não concedem autorização nem criam requisitos novos. Fonte: [Ficha Mestre](../FICHA-MODULO.md), [17 rotas e 19 ações](../MATRIZ-ACOES.md).

## Atores e fronteiras

| Ator | Acesso condicionado | Owner |
|---|---|---|
| Operador humano | JWT Keycloak, tenant membership, OpenFGA e escopo org/workspace | C03/C04/P04 + P02 |
| Administrador de tenant | Grants explícitos para cada recurso; não existe bypass genérico | C01/C04 |
| Serviço interessado | Service principal e evento versionado, tenant tx confiável | C06/P02/P03/P01 |
| Platform Manager | NÃO recebe dados Inbox de qualquer tenant automaticamente | Manager A02, Control C01 |

## Casos de uso identificados em código

| ID documental não normativo | Gatilho/objetivo | Fluxo básico de referência | Limites |
|---|---|---|---|
| UC-P02-01 | Operador consulta a fila | Seleciona queue/status/scope/q, carrega até 100, abre conversa e mensagens | Filtro `mine` deriva actor, sem escolher tenant na UI |
| UC-P02-02 | Operador cria conversa de simulação | Informa assunto e pessoa CRM opcional, cria, consulta e registra auditoria | Não envia mensagem ao WhatsApp |
| UC-P02-03 | Operador assume ou libera | PATCH assignment com actor ou null, persiste e invalida SSE | Grant `inbox:assignment/write`; escopo válido |
| UC-P02-04 | Operador responde ou registra nota | POST reply/notes, aplicação de regra da conversa e registro | WhatsApp outbound usa port P03 opt-in; nota é interna |
| UC-P02-05 | Operador organiza conversa | PATCH status/handoff/favorite/read; UI reconsulta | Regras podem ser específicas do canal WhatsApp |
| UC-P02-06 | Operador vincula CRM | PATCH contact, autorizações Inbox e CRM, FK qualificada | Não sobrescrever identidade sem política |
| UC-P02-07 | Transferência workspace | PATCH workspace, memberships origem/destino, auditoria | Mesma Platform Organization e grant específico |
| UC-P02-08 | Evento inbound WhatsApp | Consumer v2 sob mesma tenant tx, dedup e upsert, observed | Worker cutover **não homologado** |
| UC-P02-09 | CRM resolve identidade | Event consumer revalida policy, `FOR UPDATE`, vincula | Conflito implica rejeição, sem merge |
| UC-P02-10 | Operador acompanha mudanças | GET events SSE, invalidação changed, reconsulta REST | Um Host em memória; revalidação enforcement |

## Histórias descritivas e critérios a testar

**US-P02-01 (descritiva):** como operador com permissão de leitura, quero visualizar somente conversas do meu tenant e workspace. **Aceite candidato:** Given dois workspaces e usuários com grants distintos; When consultam fila e mensagens; Then nenhuma conversa/mensagem de outro escopo aparece.

**US-P02-02 (descritiva):** como operador com direito de resposta, quero responder em canal permitido. **Aceite candidato:** Given conversa WhatsApp com provider indisponível; When tento responder; Then a API falha de forma explícita, sem afirmar entrega.

**US-P02-03 (descritiva):** como supervisor autorizado, quero transferir a conversa entre workspaces aprovados. **Aceite candidato:** Given ausência de membership no destino; When transfiro; Then a tentativa é negada antes da mudança de proprietário.

**US-P02-04 (descritiva):** como integração, quero reprocessar mensagem inbound idempotentemente. **Aceite candidato:** Given o mesmo `externalMessageId` no mesmo canal/conta; When reentrego; Then não há segunda mensagem operacional.

**Casos excepcionais e testes candidatos:** actor inválido, FGA negado, SQL sem backfill/índice 002, repetição com payload divergente, status inválido, provider indisponível, SSE desconectado, contato CRM arquivado, mensagem de grupo, history source e tenant A/B. As [fichas A–J](../MATRIZ-ACOES.md) registram os edge cases individualizados, **ainda não executados nesta revisão**.

**Regra de aprovação:** decisões de negócio devem ser formalmente registradas no ESCOPO/ADR, com owner e versão. Nada neste capítulo altera a baseline aprovada.
