# P01 CRM · Criar contato · `crm-create-person`

> **Ficha de ação · template v1.0.0 congelado · 14/11/2026.** Base de leitura: `39f434e572`. Código declarado não é implantação, integração ou aceite. Requisito aprovado pertence ao [ESCOPO](../ESCOPO.md); situação ao [STATUS](../STATUS.md).

## A. Identidade e estado

| Campo | Valor |
|---|---|
| Unidade e owner | P01 CRM · `modules/core-crm` |
| Função | `cadastros` |
| ID estável | `crm-create-person` |
| Código | Código identificado · homologação pendente |
| Testes | 29 PASS históricos do CRM em 12/11; não reexecutados nesta edição |
| Homologação / deploy / Product Gate | **NÃO HOMOLOGADOS** |

## B. História de uso, objetivo e regras

**História descritiva para revisão, não requisito novo:** como operador autorizado, quero **registrar uma pessoa dentro do contexto autorizado de um tenant para iniciar ou preservar o relacionamento.**

**Resultado esperado de referência:** Person: id, tenantId, name, email, phone e archivedAt. A resposta depende do contrato real no host.

**Regras identificadas no código:**

- Não confiar em tenantId ou actorId provenientes do formulário.
- scopeWriteAllowed=false nega escrita; modo multi-org exige organizationId quando habilitado.
- O banco do tenant contém crm_people e registros de auditoria em crm_audit.
- O controller traduz validações para HTTP 400, proibição para 403, conflito de banco para 409 e indisponibilidade para 503.

**Não objetivo:** ativar serviço, migrar SQL, alterar contrato público, conceder grant, remover limites ou assumir o domínio P05 de funil/protocolo.

## C. Fluxo, casos de uso e edge cases

1. O host autentica o ator e resolve o contexto confiável do tenant.
2. CrmService.createPerson normaliza nome, email e telefone e solicita crm:people/write ao Core Kernel.
3. Após autorização, o repositório selecionado por tenant grava uma pessoa com identificador UUID.

**Edge cases a verificar — NÃO são testes executados:**

- **EC-01**: Nome vazio ou >160.
- **EC-02**: e-mail inválido.
- **EC-03**: telefone fora 10–15 dígitos.
- **EC-04**: tentativa de escrita cross-tenant.

**Diagramas existentes de referência:** [DIAGRAMAS.md](../DIAGRAMAS.md), seções 3,5. Estes não comprovam runtime.

## D. Contratos públicos/privados e API

**Método de referência:** `CrmService.createPerson(context, input: CreatePerson)`.

| Verbo | Rota declarada | Recurso |
|---|---|---|
| `POST` | `/v1/tenants/:tenantId/crm/people` | `crm:people/write` |

Um método interno não equivale a export público; confirmar `package.json#exports`. HTTP 400/401/403/409/503 depende do handler e do erro real; não generalizar sem teste.

## E. Dados, schema e integridade

**Persistência referenciada:** `crm_people, crm_audit` no **Tenant DB**. SQL real em [inventário](../INVENTARIO-INTEGRAL.md); migrations 001–003 não comprovadas como aplicadas. Organização comercial `crm_organizations` não é entidade Platform Organization nem Control DB.

## F. Segurança e limites de confiança

| Cenário | Regra a comprovar |
|---|---|
| Actor e tenant | Autenticados/resolvidos pelo Host, nunca pelo body |
| Permissão | `crm:people · write` validada pelo Kernel/FGA |
| JWT ausente ou inválido | 401 no Host |
| Membership/FGA negados | 403 / não alcançar DB indevido |
| Tenant A acessando B | Negação e ausência de leitura/escrita |
| Banco/serviço indisponível | Falha fechada; 503 conforme Host |
| Organização/workspace | Context Guard; multi-org e ENABLED exigem gates |

Fontes: [`src/context-guard.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/context-guard.ts) e [`src/crm.controller.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/crm.controller.ts). UI ocultar botão não concede/nega acesso ao backend.

## G. Frontend e experiência

Workspace CRM em `apps/workspace-web/src/features/crm.tsx` e `crm-person-detail.tsx`; não presumir tela individual da ação. Verificar loading, vazio, validação, 401/403/503, navegação por teclado, responsividade e consumo de contrato. Manager não possui acesso automático a dados tenant.

## H. Dependências e impactos

Interfaces externas por owner (A01 Workspace, A04 Host, A08 Kernel, C01 Control, C03 Keycloak, C04 OpenFGA, P02 Inbox, P03 WhatsApp e P04 Organizations), somente onde aplicável. Não modificar internals externos. Conferir versão/consumidores de API/SQL/evento antes de mudança.

## I. Testes, Given/When/Then e evidência

**Arquivos de teste relacionados (existência não garante cobertura):**

- [`modules/core-crm/test/crm.test.mjs`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/test/crm.test.mjs)
- [`modules/core-crm/test/context-guard.test.mjs`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/test/context-guard.test.mjs)

| Caso proposto | Dado | Quando | Então a demonstrar |
|---|---|---|---|
| CP-01 | Ator autorizado do tenant A | Solicita criar contato | Resultado tipado e escopo corretos |
| CP-02 | Actor sem permissão | Solicita mesma ação | Negativa sem mutação nem vazamento |
| CP-03 | Dados do tenant B | Chamada com sessão do tenant A | Bloqueio ou ausência de dados cruzados |
| CP-04 | Nome vazio ou >160 | Executa fluxo excepcional | Erro/revisão conforme método real |

**Critérios históricos/documentais a confirmar:**

- [ ] Nome inválido, vazio ou acima do limite é rejeitado.
- [ ] Operador sem crm:people/write não cria registro.
- [ ] Dados de tenant A não aparecem em tenant B.
- [ ] Criar e consultar o contato é comprovado com JWT/FGA e PostgreSQL reais.
- [ ] Registrar SHA, ambiente, logs e resultado de aceite.

**Comando real:** `cd modules/core-crm && npm test`. Não houve execução de testes do CRM nesta edição documental.

## J. Decisões, pendências e pacote do agente

**Nova decisão aprovada:** nenhuma. Para planejar, usar esta ficha + ESCOPO/STATUS + código atual/SHA e levantar impacto, alternativas, WBS e testes **sem alterar runtime**. Para implementar, exigir requisito aprovado, caminhos do owner, testes/negativas e atualizar código, contrato, diagrama, STATUS e fichas no mesmo incremento.

**Fontes exatas:**

- [`src/service.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/service.ts)
- [`src/validation.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/validation.ts)
- [`src/postgres.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/postgres.ts)

[Voltar à matriz](../MATRIZ-ACOES.md) · [Ficha Mestre](../FICHA-MODULO.md).
