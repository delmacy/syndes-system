# CRM P01 · Gerenciar tags de contatos · `crm-tags`

> **Ficha de ação · template v1.0.0 congelado · 14/11/2026.** Base `39f434e572`; a identificação de código não equivale a deploy/homologação. [ESCOPO](../ESCOPO.md) rege requisitos e aprovações; [STATUS](../STATUS.md) e [EVOLUÇÃO](../EVOLUCAO.md) registram limites e planejamento.

## A. Identidade e estado

| Campo | Situação |
|---|---|
| Owner | P01 CRM · `modules/core-crm` |
| Função | `cadastros` |
| ID | `crm-tags` |
| Implementação | Código identificado · homologação pendente |
| Testes históricos | 29 PASS locais de 12/11; sem execução nova |
| Integração, operação e Product Gate | **NÃO HOMOLOGADOS** |
| Requisito novo aprovado | **NENHUM** por esta ficha |

## B. História de usuário e regras

**História descritiva para revisão:** como operador ou consumidor autorizado, quero **criar, listar, vincular, consultar e desvincular tags com controle de tenant.**

**Resultado de referência:** Resultado tipado do método ou resposta HTTP declarada no CrmController.

**Regra especial do domínio:** Tag e vínculos são específicos do tenant, sem exclusão física da Person.

**Regras registradas:**

- O contexto autenticado e o tenant são resolvidos por componentes confiáveis.
- A existência do método não equivale a execução homologada.
- Conferir validações e tratamento de erros no código e em testes antes de alterar.

Não ampliar escopo do CRM para identidade, suporte, P05 (funil) ou processos internos de Inbox/WhatsApp.

## C. Fluxo, alternativas e edge cases

1. Resolver identidade, tenant e escopo operacional pelo host/autorização quando aplicável.
2. Aplicar as validações e regras existentes no método do módulo.
3. Consultar ou persistir somente os registros do tenant/organização autorizados.

**Edge cases de verificação (NÃO executados nesta documentação):**

- **EC-01** — Tag vazia ou >64.
- **EC-02** — tag duplicada/case.
- **EC-03** — vínculo repetido.
- **EC-04** — read permitido mas write negado.

**Diagramas existentes:** [DIAGRAMAS.md](../DIAGRAMAS.md), seções 2,5. Diagrama não comprova ativação de worker, integração nem operação.

## D. Contratos, métodos e APIs

**Método e/ ou contrato:** `CrmService.createTag / tagPerson; CrmExtras.listTags / listPersonTags / unlinkTag`.

| Método | Rota | Recurso |
|---|---|---|
| `GET` | `/v1/tenants/:tenantId/crm/tags` | `crm:tags/read` |
| `DELETE` | `/v1/tenants/:tenantId/crm/people/:id/tags/:tagId` | `crm:tags/write` |
| `POST` | `/v1/tenants/:tenantId/crm/tags` | `crm:tags/write` |
| `POST` | `/v1/tenants/:tenantId/crm/people/:id/tags` | `crm:tags/write` |
| `GET` | `/v1/tenants/:tenantId/crm/people/:id/tags` | `crm:tags/read` |

**Permissão/escopo de referência:** `crm:tags/read/write`. Ver [inventário HTTP](../INVENTARIO-INTEGRAL.md) e [`src/crm.controller.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/crm.controller.ts). Confirme exports `package.json#exports`; não publicar internals por conveniência. Para eventos, consultar contrato versionado e serviço de entrega, não inventar endpoint REST.

## E. Dados, schema e integridade

**Objetos envolvidos:** `crm_tags, crm_person_tags, crm_audit`; banco do tenant quando aplicável. Migrations existentes não equivalem a aplicação em staging/produção; dicionário completo: [9 tabelas e 53 colunas](../INVENTARIO-INTEGRAL.md). Control DB e processamento de filas possuem owners próprios.

## F. Segurança e limites de confiança

| Situação | Critério a verificar |
|---|---|
| Principal autenticado | JWT pelo Host nas ações HTTP; serviço confiável em eventos |
| Grant por ação | `crm:tags/read/write`, recurso/método correto |
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

- [`test/crm.test.mjs`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/test/crm.test.mjs)
- [`test/extras.test.mjs`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/test/extras.test.mjs)

| Caso proposto | Dado | Quando | Então esperado |
|---|---|---|---|
| CP-01 | Escopo e ator permitidos | Executa gerenciar tags de contatos | Saída coerente com contrato |
| CP-02 | Permissão ou service grant ausente | Executa mesma ação | Rejeição/falha segura |
| CP-03 | Tenant B/organização alheia | Solicitação originada em A | Nenhum vazamento ou escrita cruzada |
| CP-04 | Tag vazia ou >64 | Reproduz condição | Rejeição ou review, com efeito verificável |

**Aceites editoriais a confrontar com o código/testes:** Conferir schema de entrada e respostas do controller.; Testar permissão e negativas no Core Kernel/OpenFGA.; Testar isolamento entre tenants e, onde aplicável, organização.; Registrar SHA, ambiente e evidência de homologação..

Comando `cd modules/core-crm && npm test` existe; **não executado** neste incremento. Teste de PostgreSQL real, retries, grants, browser e restore são provas independentes.

## J. Decisões, observações e handoff

- **Nenhuma nova regra foi aprovada.** Os edge cases estão documentados para revisão.
- Para planejar: ação + observação + ESCOPO, STATUS, contrato e código atual + SHA; entregar alternativas, risco, WBS, dependências e critérios.
- Para implementar: requisito e paths aprovados; preservar autorização e owner, testar positivos/negativos e atualizar código, documentação, diagramas, STATUS e WBS no mesmo incremento.
- Resultado mínimo: commit/SHA, PASS/FAIL/SKIP, ambientes, negativas, limitações e próxima decisão.

**Fontes versionadas desta ação:**

- [src/service.ts](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/service.ts)
- [src/extra.ts](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/extra.ts)
- [STATUS P01](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/docs/subprojects/P01-crm/STATUS.md)

[Voltar à matriz](../MATRIZ-ACOES.md) · [Ficha Mestre](../FICHA-MODULO.md).
