# CRM P01 · Consultar, editar e arquivar empresa · `crm-manage-organizations`

> **Ficha de ação · template v1.0.0 congelado · 14/11/2026.** Auditoria documental sobre `39f434e572`; implementação presente **não significa integração, deploy, operação ou aceite**. Requisitos oficiais: [ESCOPO](../ESCOPO.md), status: [STATUS](../STATUS.md).

## A. Identificação, escopo e evidência

| Campo | Referência |
|---|---|
| Owner | P01 · `modules/core-crm` |
| Função | `cadastros` |
| Ação estável | `crm-manage-organizations` |
| Código | Código identificado · homologação pendente |
| Testes executados nesta edição | **NENHUM**; 29 PASS históricos do CRM na auditoria anterior |
| Produto/deploy | **NÃO HOMOLOGADOS** |
| Aprovação de nova implementação | **NÃO IDENTIFICADA** |

## B. História e resultado esperado

**História descritiva para revisão:** como operador ou integrador autorizado, quero **manter organizações comerciais do CRM, distintas de organizações da plataforma.**

**Resultado:** Resultado tipado do método ou resposta HTTP declarada no CrmController.

**Regras e limites registrados:**

- O contexto autenticado e o tenant são resolvidos por componentes confiáveis.
- A existência do método não equivale a execução homologada.
- Conferir validações e tratamento de erros no código e em testes antes de alterar.

Esta descrição não aprova novo requisito, nem autoriza edição de código, IAM, migrations, ativação de worker ou deploy.

## C. Fluxo, casos alternativos e edge cases

1. Resolver identidade, tenant e escopo operacional pelo host/autorização quando aplicável.
2. Aplicar as validações e regras existentes no método do módulo.
3. Consultar ou persistir somente os registros do tenant/organização autorizados.

**Exceções a verificar, não testadas por este documento:**

- **EC-01** — Empresa arquivada ou inexistente.
- **EC-02** — taxId com dígitos não verificados.
- **EC-03** — acesso read sem write.
- **EC-04** — multi-org sem gate.

Diagramas existentes: [DIAGRAMAS.md](../DIAGRAMAS.md), seções **2,5**. Não deduzir homologação de um fluxo Mermaid.

## D. Interfaces, APIs e contratos

**Método/contrato:** `CrmExtras.getOrganization / listOrganizations / updateOrganization / archiveOrganization`. **Permissão ou contexto:** `crm:organizations/read/write`.

| Verbo | Rota declarada | Recurso |
|---|---|---|
| `GET` | `/v1/tenants/:tenantId/crm/organizations` | `crm:organizations/read` |
| `GET` | `/v1/tenants/:tenantId/crm/organizations/:id` | `crm:organizations/read` |
| `PATCH` | `/v1/tenants/:tenantId/crm/organizations/:id` | `crm:organizations/write` |
| `DELETE` | `/v1/tenants/:tenantId/crm/organizations/:id` | `crm:organizations/write` |

As 30 rotas mapeadas do CRM estão em [INVENTARIO-INTEGRAL.md](../INVENTARIO-INTEGRAL.md). Uma classe interna ou schema não é automaticamente contrato público. Erros dependem do handler; autenticação, autorização e disponibilidade não podem ser inferidas apenas pelo tipo do método.

## E. Dados e integridade

**Objetos relacionados:** `crm_organizations, crm_audit`. Dados CRM estão no banco do tenant; o Control DB pertence a seu owner. Sem SQL próprio para ações apenas normativas, de integração ou de gate. Migrations 001–003 existem; versão aplicada por ambiente **NÃO COMPROVADA**. [Dicionário de colunas](../INVENTARIO-INTEGRAL.md).

## F. Autorização, confiança e isolamento

| Contexto | Critério |
|---|---|
| JWT/actor | Identidade verificada pelo Host em endpoints HTTP |
| Permissão | `crm:organizations/read/write`; aplicar FGA/Kernel no recurso concreto |
| Sem autenticação | 401 onde houver HTTP |
| Membership/FGA negados | 403 ou erro seguro; sem acesso cruzado |
| Tenant A/B | Banco e escopo resolvidos por fonte confiável |
| Infra indisponível | Falha fechada (503 conforme Host), não acesso por fallback |
| Multi-org/workspaces | Gates SQL 002 e flags não equivalem a rollout aprovado |

Fonte: [`src/context-guard.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/context-guard.ts).

## G. Frontend e interação

Quando a ação alcança UI, consumidor provável é Workspace `apps/workspace-web/src/features/crm.tsx`; **NÃO SE APLICA tela dedicada** quando a ação é contrato técnico/Product Gate. Verificar teclado, estado vazio, loading, 401/403/503 e acesso por tenant. Manager não ganha acesso automático a contato.

## H. Integrações e análise de impacto

Alterações de contratos afetados exigem revisão de owner externo (A01, A04, A08, C01, C03, C04, P02/P03/P04/P05 quando houver interface). Não alterar implementação privada alheia; mapear consumidores, versão, migrations, eventos e rollback antes da autorização.

## I. Testes, cenários Given/When/Then e provas

**Arquivos de teste relacionados (presença não é cobertura comprovada da ação):**

- [`test/crm.test.mjs`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/test/crm.test.mjs)
- [`test/extras.test.mjs`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/test/extras.test.mjs)

| Cenário **proposto** | Dado | Quando | Então a demonstrar |
|---|---|---|---|
| CP-01 | Pré-condições e principal autorizados | Executa consultar, editar e arquivar empresa | Contrato e resultado de referência |
| CP-02 | Principal sem grant | Executa a mesma ação | Acesso negado sem mutação |
| CP-03 | Recurso do tenant B | Principal do tenant A tenta usar | Não ler nem modificar tenant B |
| CP-04 | Empresa arquivada ou inexistente | Reproduz a condição | Tratamento seguro segundo contrato |

**Critérios de aceite existentes na ficha editorial (a revisar):**

- [ ] Conferir schema de entrada e respostas do controller.
- [ ] Testar permissão e negativas no Core Kernel/OpenFGA.
- [ ] Testar isolamento entre tenants e, onde aplicável, organização.
- [ ] Registrar SHA, ambiente e evidência de homologação.

Comando `cd modules/core-crm && npm test` existe; não foi executado nesta atualização documental. Browser E2E, IAM A/B e restore exigem provas independentes.

## J. Decisões, observações e handoff

- Decisão aprovada nesta edição: **nenhuma**; registrar observação com ID e owner antes de alterar código.
- Planejamento: ler esta ficha, ESCOPO, STATUS, AGENTS, SHA e contratos; propor WBS, edge cases, critérios e riscos **sem implementar**.
- Implementação: somente com autorização explícita; alterar código do owner, testar e reconciliar fichas, contratos, diagramas, STATUS e WBS na mesma entrega.
- Registro final: commit, execução PASS/FAIL/SKIP, evidência real de ambiente/tenancy, pendências e owners.

**Fontes de código:**

- [`src/extra.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/extra.ts)
- [`src/postgres.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/postgres.ts)

[Voltar ao índice](../MATRIZ-ACOES.md) · [Ficha Mestre](../FICHA-MODULO.md).
