# CRM P01 · Validar autorização e isolamento · `crm-authorization`

> **Ficha de ação · template v1.0.0 congelado · 14/11/2026.** Auditoria documental sobre `39f434e572`; implementação presente **não significa integração, deploy, operação ou aceite**. Requisitos oficiais: [ESCOPO](../ESCOPO.md), status: [STATUS](../STATUS.md).

## A. Identificação, escopo e evidência

| Campo | Referência |
|---|---|
| Owner | P01 · `modules/core-crm` |
| Função | `validacoes` |
| Ação estável | `crm-authorization` |
| Código | Guardas identificadas · E2E pendente |
| Testes executados nesta edição | **NENHUM**; 29 PASS históricos do CRM na auditoria anterior |
| Produto/deploy | **NÃO HOMOLOGADOS** |
| Aprovação de nova implementação | **NÃO IDENTIFICADA** |

## B. História e resultado esperado

**História descritiva para revisão:** como operador ou integrador autorizado, quero **proibir operações fora do tenant, organização ou permissão autorizados.**

**Resultado:** Autorização ou erro HTTP; não retorna dados de outro escopo.

**Regras e limites registrados:**

- 401 identifica autenticação ausente ou inválida.
- 403 representa proibição; 503 falha de infraestrutura, sem autorizar por erro.
- Não ativar multi-org sem gates e testes reais.

Esta descrição não aprova novo requisito, nem autoriza edição de código, IAM, migrations, ativação de worker ou deploy.

## C. Fluxo, casos alternativos e edge cases

1. O host valida bearer e resolve actor/tenant.
2. CoreKernel.execute avalia recurso e ação antes do repositório.
3. O contexto pode negar escrita e exigir organização quando multi-org está habilitado.

**Exceções a verificar, não testadas por este documento:**

- **EC-01** — JWT inválido 401.
- **EC-02** — FGA/membership negados 403.
- **EC-03** — tenant DB divergente 503.
- **EC-04** — rollout legacy/enforce e multi-org sem gates.

Diagramas existentes: [DIAGRAMAS.md](../DIAGRAMAS.md), seções **5,6**. Não deduzir homologação de um fluxo Mermaid.

## D. Interfaces, APIs e contratos

**Método/contrato:** `CrmService.execute / CrmHost.run`. **Permissão ou contexto:** `CoreKernel e recursos crm:*`.

| Verbo | Rota declarada | Recurso |
|---|---|---|
| `GET` | `/v1/tenants/:tenantId/crm/capabilities` | `crm:context/read` |

As 30 rotas mapeadas do CRM estão em [INVENTARIO-INTEGRAL.md](../INVENTARIO-INTEGRAL.md). Uma classe interna ou schema não é automaticamente contrato público. Erros dependem do handler; autenticação, autorização e disponibilidade não podem ser inferidas apenas pelo tipo do método.

## E. Dados e integridade

**Objetos relacionados:** `Banco de tenant confiável`. Dados CRM estão no banco do tenant; o Control DB pertence a seu owner. Sem SQL próprio para ações apenas normativas, de integração ou de gate. Migrations 001–003 existem; versão aplicada por ambiente **NÃO COMPROVADA**. [Dicionário de colunas](../INVENTARIO-INTEGRAL.md).

## F. Autorização, confiança e isolamento

| Contexto | Critério |
|---|---|
| JWT/actor | Identidade verificada pelo Host em endpoints HTTP |
| Permissão | `CoreKernel e recursos crm:*`; aplicar FGA/Kernel no recurso concreto |
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

- [`test/context-guard.test.mjs`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/test/context-guard.test.mjs)
- [`test/context-propagation.test.mjs`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/test/context-propagation.test.mjs)
- [`test/scope-query.test.mjs`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/test/scope-query.test.mjs)

| Cenário **proposto** | Dado | Quando | Então a demonstrar |
|---|---|---|---|
| CP-01 | Pré-condições e principal autorizados | Executa validar autorização e isolamento | Contrato e resultado de referência |
| CP-02 | Principal sem grant | Executa a mesma ação | Acesso negado sem mutação |
| CP-03 | Recurso do tenant B | Principal do tenant A tenta usar | Não ler nem modificar tenant B |
| CP-04 | JWT inválido 401 | Reproduz a condição | Tratamento seguro segundo contrato |

**Critérios de aceite existentes na ficha editorial (a revisar):**

- [ ] JWT inválido: 401.
- [ ] Operador sem recurso: 403.
- [ ] Tenant A/B isolados.
- [ ] Infra indisponível: 503 sem fail-open.

Comando `cd modules/core-crm && npm test` existe; não foi executado nesta atualização documental. Browser E2E, IAM A/B e restore exigem provas independentes.

## J. Decisões, observações e handoff

- Decisão aprovada nesta edição: **nenhuma**; registrar observação com ID e owner antes de alterar código.
- Planejamento: ler esta ficha, ESCOPO, STATUS, AGENTS, SHA e contratos; propor WBS, edge cases, critérios e riscos **sem implementar**.
- Implementação: somente com autorização explícita; alterar código do owner, testar e reconciliar fichas, contratos, diagramas, STATUS e WBS na mesma entrega.
- Registro final: commit, execução PASS/FAIL/SKIP, evidência real de ambiente/tenancy, pendências e owners.

**Fontes de código:**

- [`src/crm.controller.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/crm.controller.ts)
- [`src/context-guard.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/context-guard.ts)
- [`src/scope-query.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/scope-query.ts)

[Voltar ao índice](../MATRIZ-ACOES.md) · [Ficha Mestre](../FICHA-MODULO.md).
