# P01 CRM · Registrar nota de atendimento · `crm-create-note`

> **Ficha de ação · template v1.0.0 congelado · 14/11/2026.** Base de leitura: `39f434e572`. Código declarado não é implantação, integração ou aceite. Requisito aprovado pertence ao [ESCOPO](../ESCOPO.md); situação ao [STATUS](../STATUS.md).

## A. Identidade e estado

| Campo | Valor |
|---|---|
| Unidade e owner | P01 CRM · `modules/core-crm` |
| Função | `atendimento` |
| ID estável | `crm-create-note` |
| Código | Código identificado · homologação pendente |
| Testes | 29 PASS históricos do CRM em 12/11; não reexecutados nesta edição |
| Homologação / deploy / Product Gate | **NÃO HOMOLOGADOS** |

## B. História de uso, objetivo e regras

**História descritiva para revisão, não requisito novo:** como operador autorizado, quero **preservar contexto escrito de uma interação para consultas posteriores.**

**Resultado esperado de referência:** Note com id, tenantId, personId, body, createdBy e createdAt.

**Regras identificadas no código:**

- Controles inválidos e notas vazias são rejeitados.
- A nota pertence à pessoa e ao tenant informado pelo host autenticado.
- Registrar nota não significa automaticamente publicar evento ou enviar mensagem WhatsApp.

**Não objetivo:** ativar serviço, migrar SQL, alterar contrato público, conceder grant, remover limites ou assumir o domínio P05 de funil/protocolo.

## C. Fluxo, casos de uso e edge cases

1. Seleciona a pessoa autorizada por UUID.
2. Normaliza quebras de linha, remove espaços nas extremidades e valida o corpo.
3. Solicita crm:notes/write e registra a nota com autor e data.

**Edge cases a verificar — NÃO são testes executados:**

- **EC-01**: Nota vazia.
- **EC-02**: corpo acima de 5000.
- **EC-03**: caracteres de controle.
- **EC-04**: pessoa inexistente/tenant diferente.

**Diagramas existentes de referência:** [DIAGRAMAS.md](../DIAGRAMAS.md), seções 2,5. Estes não comprovam runtime.

## D. Contratos públicos/privados e API

**Método de referência:** `CrmService.createNote`.

| Verbo | Rota declarada | Recurso |
|---|---|---|
| `POST` | `/v1/tenants/:tenantId/crm/people/:id/notes` | `crm:notes/write` |

Um método interno não equivale a export público; confirmar `package.json#exports`. HTTP 400/401/403/409/503 depende do handler e do erro real; não generalizar sem teste.

## E. Dados, schema e integridade

**Persistência referenciada:** `crm_notes` no **Tenant DB**. SQL real em [inventário](../INVENTARIO-INTEGRAL.md); migrations 001–003 não comprovadas como aplicadas. Organização comercial `crm_organizations` não é entidade Platform Organization nem Control DB.

## F. Segurança e limites de confiança

| Cenário | Regra a comprovar |
|---|---|
| Actor e tenant | Autenticados/resolvidos pelo Host, nunca pelo body |
| Permissão | `crm:notes · write` validada pelo Kernel/FGA |
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

| Caso proposto | Dado | Quando | Então a demonstrar |
|---|---|---|---|
| CP-01 | Ator autorizado do tenant A | Solicita registrar nota de atendimento | Resultado tipado e escopo corretos |
| CP-02 | Actor sem permissão | Solicita mesma ação | Negativa sem mutação nem vazamento |
| CP-03 | Dados do tenant B | Chamada com sessão do tenant A | Bloqueio ou ausência de dados cruzados |
| CP-04 | Nota vazia | Executa fluxo excepcional | Erro/revisão conforme método real |

**Critérios históricos/documentais a confirmar:**

- [ ] Registrar e consultar nota com autor correto.
- [ ] Rejeitar texto vazio ou superior ao limite.
- [ ] Bloquear acesso cruzado entre tenants.
- [ ] Executar com identidade e autorização reais.

**Comando real:** `cd modules/core-crm && npm test`. Não houve execução de testes do CRM nesta edição documental.

## J. Decisões, pendências e pacote do agente

**Nova decisão aprovada:** nenhuma. Para planejar, usar esta ficha + ESCOPO/STATUS + código atual/SHA e levantar impacto, alternativas, WBS e testes **sem alterar runtime**. Para implementar, exigir requisito aprovado, caminhos do owner, testes/negativas e atualizar código, contrato, diagrama, STATUS e fichas no mesmo incremento.

**Fontes exatas:**

- [`src/service.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/service.ts)
- [`src/postgres.ts`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src/postgres.ts)
- [`sql/002_crm_tags_notes.sql`](https://github.com/delmacy/syndes-system/blob/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/sql/002_crm_tags_notes.sql)

[Voltar à matriz](../MATRIZ-ACOES.md) · [Ficha Mestre](../FICHA-MODULO.md).
