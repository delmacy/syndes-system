# Modelo — Referência técnica de um módulo

> **TEMPLATE.** O resultado é uma página por módulo: `docs/subprojects/<ID>-<slug>/REFERENCIA-TECNICA.md`.
> Não confundir código presente, export público, teste local, integração e operação. Não inventar assinatura, tabela ou rota. Cada registro deve citar o **arquivo-fonte exato**, com classe/método e versão/commit quando pertinente.

## 1. Responsabilidade e stack

| Campo | Informação verificada |
|---|---|
| Owner | [ID, nome e unidade de código] |
| Natureza | [Kernel, Core Host, produto backend, frontend ou infra] |
| Linguagens/frameworks | [package, versão e fonte comprovada] |
| Build/testes | [comandos reais e último resultado] |
| Runtime/deploy | [composição atual e ativação confirmada ou pendente] |
| Módulos dependentes | [somente interfaces públicas comprovadas] |

## 2. Backend: classes, serviços e métodos

| Classe / interface | Método público (assinatura) | Entrada e retorno | Efeitos e autorização | Fonte exata | Teste / estado |
|---|---|---|---|---|---|
| [Classe] | [método] | [tipos reais] | [transação, tenant, roles, erros] | [src e linha] | [TESTADO / PROPOSTO / etc.] |

Métodos internos críticos: resumir responsabilidade e risco, sem transformar API privada em contrato público. Para interfaces públicas, conferir `package.json#exports` e `src/index.ts`. Interfaces internas não viram contrato apenas porque um arquivo TS declara `export`.

## 3. Interfaces e contratos públicos

| ID / versão | Tipo | Producer / provider | Consumer | Disponibilidade | Documento / fonte |
|---|---|---|---|---|---|
| [HTTP, TS port, evento, capability] | [REST / TypeScript / Events] | [owner] | [consumer] | [DECLARADO / IMPLEMENTADO / TESTADO / INTEGRADO / OPERACIONAL / ACEITO] | [path] |

Incluir auth, tenant/org/workspace, idempotência, payload, erros e compatibilidade. Contratos ainda não publicados formalmente precisam da marca **INTERNO / NÃO IMPORTÁVEL**.

## 4. Frontend — aplicações, telas e componentes

| Aplicação | Tela / rota verificada | Componente fonte | Consumo de contrato | Escopo de acesso | Evidência |
|---|---|---|---|---|---|
| Workspace / Manager / Support | [rota real ou a verificar] | [path exato] | [API] | [perfil/tenant] | [browser / código] |

Uma tela pode consumir vários módulos. Sua propriedade de aplicação continua em `apps/workspace-web`, `apps/master-admin-web` ou `apps/support-web`. Componentes compartilhados visuais pertencem a `packages/front-shared`. **Não criar um frontend duplicado para cada módulo**.

## 5. Schemas e armazenamento

| Banco e owner | Tabela / objeto | Migration exata | Relação e tenancy | Gates de ativação |
|---|---|---|---|---|
| Tenant DB / [owner] | [tabela real] | [path SQL] | [FK / tenant/org/workspace] | [restrições] |
| Control/Manager DB / [owner] | [tabela real, ou NENHUMA] | [path SQL] | [tenant registry, entitlement etc.] | [migração/roles] |

**Banco do Manager não é o tenant DB.** Se o módulo não possuir objetos no Control DB, escrever explicitamente "Nenhuma tabela própria"; usar contratos/lookup se necessário. Documentar migrations manuais sem marcá-las como aplicadas.

## 6. Fluxos e diagramas

Mermaid no corpo: componentes, sequência de requisição, entidades e fluxos de erro. Diferenciar conexões implementadas, opt-in e planejadas.

## 7. Evidências, riscos e pendências

- **Checkout SHA:** [hash] · **Data:** [data].
- **Testes:** [nome, comando e resultado; skips separados].
- **Gates:** [identidade, migrações, grants, compatibilidade, restore, navegador, deploy].
- **Atualização documental:** ao mudar contrato, classe exportada, API, UI ou schema, atualizar esta página no mesmo incremento e citar a fonte.
- **Privacidade:** não expor valores de segredo, credenciais, PII nem topologia administrativa sensível em Pages público.

## 8. Próxima ação aprovada

[WBS, Issue, owner, autorização e prompt de implementação, se existentes; se não, **A PRIORIZAR**].
