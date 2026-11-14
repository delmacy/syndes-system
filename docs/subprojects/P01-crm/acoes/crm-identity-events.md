# CRM P01 · Resolver identidade de WhatsApp por eventos · `crm-identity-events`

> **Ficha de ação · template v1.0.0 congelado · 14/11/2026.** Base `39f434e572`; a identificação de código não equivale a deploy/homologação. [ESCOPO](../ESCOPO.md) rege requisitos e aprovações; [STATUS](../STATUS.md) e [EVOLUÇÃO](../EVOLUCAO.md) registram limites e planejamento.

## A. Identidade e estado

| Campo | Situação |
|---|---|
| Owner | P01 CRM · `modules/core-crm` |
| Função | `integracoes` |
| ID | `crm-identity-events` |
| Implementação | Código identificado · homologação pendente |
| Testes históricos | 29 PASS locais de 12/11; sem execução nova |
| Integração, operação e Product Gate | **NÃO HOMOLOGADOS** |
| Requisito novo aprovado | **NENHUM** por esta ficha |

## B. História de usuário e regras

**História descritiva para revisão:** como operador ou consumidor autorizado, quero **consumir observação de participante e emitir resolução ou revisão sob o mesmo escopo; ativação operacional não comprovada.**

**Resultado de referência:** crm.person.resolved.v1 ou crm.person.review_required.v1, condicionado ao consumidor opt-in.

**Regra especial do domínio:** Policy não deriva telefone de LID nem grava diretamente Inbox/WhatsApp.

**Regras registradas:**

- Requer tenantId, organizationId e workspaceId consistentes.
- Não cria contatos nem escreve diretamente em Inbox/WhatsApp.
- Revisão humana e cutover operacional continuam pendentes.

Não ampliar escopo do CRM para identidade, suporte, P05 (funil) ou processos internos de Inbox/WhatsApp.

## C. Fluxo, alternativas e edge cases

1. Resolver identidade, tenant e escopo operacional pelo host/autorização quando aplicável.
2. Aplicar as validações e regras existentes no método do módulo.
3. Consultar ou persistir somente os registros do tenant/organização autorizados.

**Edge cases de verificação (NÃO executados nesta documentação):**

- **EC-01** — Ambiguous por múltiplos candidatos.
- **EC-02** — missing_identity.
- **EC-03** — conflicting_link.
- **EC-04** — JID LID sem phone.
- **EC-05** — replay/cross-scope.
- **EC-06** — worker não ativo.

**Diagramas existentes:** [DIAGRAMAS.md](../DIAGRAMAS.md), seções 4,5,6. Diagrama não comprova ativação de worker, integração nem operação.

## D. Contratos, métodos e APIs

**Método e/ ou contrato:** `CrmWhatsAppIdentityPolicy.decide / validateLink; CrmWhatsAppIdentityConsumer.handle`.

**NÃO SE APLICA:** evento assíncrono por contrato versionado, não API HTTP dedicada.

**Permissão/escopo de referência:** `Contrato de evento e escopo validado`. Ver [inventário HTTP](../INVENTARIO-INTEGRAL.md) e [`src/crm.controller.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/crm.controller.ts). Confirme exports `package.json#exports`; não publicar internals por conveniência. Para eventos, consultar contrato versionado e serviço de entrega, não inventar endpoint REST.

## E. Dados, schema e integridade

**Objetos envolvidos:** `crm_people, crm_channel_identities e evento transacional`; banco do tenant quando aplicável. Migrations existentes não equivalem a aplicação em staging/produção; dicionário completo: [9 tabelas e 53 colunas](../INVENTARIO-INTEGRAL.md). Control DB e processamento de filas possuem owners próprios.

## F. Segurança e limites de confiança

| Situação | Critério a verificar |
|---|---|
| Principal autenticado | JWT pelo Host nas ações HTTP; serviço confiável em eventos |
| Grant por ação | `Contrato de evento e escopo validado`, recurso/método correto |
| Falta de JWT (HTTP) | 401; não criar fallback |
| FGA/membership negados | 403 ou erro seguro sem mutação |
| Dados de tenant B | Nunca acessíveis pelo tenant A |
| Organization/workspace | Contexto confiável, SQL 002 e gates condicionais |
| Serviço/DB indisponível | Fail-closed, sem autorização por erro |

Fonte: [`src/context-guard.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/context-guard.ts) e [matriz geral](../MATRIZ-ACOES.md). A ativação de worker/secret/grant exige owner, autorização e Product Gate.

## G. Frontend e jornada

Workspace `apps/workspace-web/src/features/crm.tsx` e `crm-person-detail.tsx` podem consumir parte destas ações; **não presumir tela individual**. Validar carregamento, estado vazio, confirmação, validação, acessibilidade e 401/403/503. Para consumer/evento de backend, UI própria é **NÃO SE APLICA** sem rota comprovada. Manager não tem leitura tenant implícita.

## H. Integrações e impacto de mudança

Contratos externos usam owner A01 (Workspace), A04/A08 (Host/Kernel), C01/P04 (membership/organizations), C03/C04 (IAM) e P02/P03/C06 (Inbox/WhatsApp/Event Bus) somente quando aplicáveis. Não editar internals externos. Ao alterar payload, método, DTO ou persistência: verificar consumidores, compatibilidade, migração, replay e rollback.

## I. Testes e critérios Given/When/Then

**Arquivos de teste relacionados (sem alegar cobertura completa):**

- [`test/context-propagation.test.mjs`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/test/context-propagation.test.mjs)
- [`test/acceptance-journey.mjs`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/test/acceptance-journey.mjs)

| Caso proposto | Dado | Quando | Então esperado |
|---|---|---|---|
| CP-01 | Escopo e ator permitidos | Executa resolver identidade de whatsapp por eventos | Saída coerente com contrato |
| CP-02 | Permissão ou service grant ausente | Executa mesma ação | Rejeição/falha segura |
| CP-03 | Tenant B/organização alheia | Solicitação originada em A | Nenhum vazamento ou escrita cruzada |
| CP-04 | Ambiguous por múltiplos candidatos | Reproduz condição | Rejeição ou review, com efeito verificável |

**Aceites editoriais a confrontar com o código/testes:** Conferir schema de entrada e respostas do controller.; Testar permissão e negativas no Core Kernel/OpenFGA.; Testar isolamento entre tenants e, onde aplicável, organização.; Registrar SHA, ambiente e evidência de homologação..

Comando `cd modules/core-crm && npm test` existe; **não executado** neste incremento. Teste de PostgreSQL real, retries, grants, browser e restore são provas independentes.

## J. Decisões, observações e handoff

- **Nenhuma nova regra foi aprovada.** Os edge cases estão documentados para revisão.
- Para planejar: ação + observação + ESCOPO, STATUS, contrato e código atual + SHA; entregar alternativas, risco, WBS, dependências e critérios.
- Para implementar: requisito e paths aprovados; preservar autorização e owner, testar positivos/negativos e atualizar código, documentação, diagramas, STATUS e WBS no mesmo incremento.
- Resultado mínimo: commit/SHA, PASS/FAIL/SKIP, ambientes, negativas, limitações e próxima decisão.

**Fontes versionadas desta ação:**

- [src/whatsapp-identity-events.ts](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/whatsapp-identity-events.ts)
- [STATUS P01](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/docs/subprojects/P01-crm/STATUS.md)

[Voltar à matriz](../MATRIZ-ACOES.md) · [Ficha Mestre](../FICHA-MODULO.md).
