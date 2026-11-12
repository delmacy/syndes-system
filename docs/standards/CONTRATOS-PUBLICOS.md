# Syndes — contratos públicos e limites de importação
> Índice normativo de descoberta (rascunho v0.1). **A fonte executável é o código**, não este documento. Não significa que os módulos/capabilities estejam instalados ou homologados.

## Camadas e registro
1. O Core Kernel define ports e os tipos comuns; consultar `packages/core-kernel`.
2. Cada módulo é proprietário de seus tipos, eventos, APIs e contratos públicos.
3. O Core Host compõe módulos instalados a partir de `ModuleDefinition` / `syndesPlugin` existentes, não lendo Markdown como registro operacional.
4. `catalog/work-units.json` é fonte de ownership; `docs/subprojects/index.json` é índice de caminhos de documentação, **não configuração de runtime**.
5. A superfície de importação autorizada decorre de `package.json#exports`; outros módulos não podem importar arquivos internos arbitrariamente, mesmo visíveis no monorepo.

## Pontos de entrada públicos verificados em código
| Proprietário | Pacote | Artefatos de referência | Regra |
|---|---|---|---|
| A08 Core Kernel | `@syndes/core-kernel` | `packages/core-kernel/package.json`, `src/` | Utilizar exports explícitos |
| P01 CRM | `@syndes/core-crm` | `modules/core-crm/package.json`, `src/plugin.ts`, `src/contracts.ts`, `src/crm.controller.ts` | `package.json` expõe `.` e `./plugin`; o caminho `src/contracts.ts` **não** é import público independente confirmado |
| P02 Inbox | `@syndes/inbox` **(verificar nome no package.json)** | `modules/inbox/package.json`, `src/plugin.ts` | Conferir exports reais antes de importar |

## Categorias de contrato
- **API HTTP:** rotas, contratos de erro, autenticação e autorização.
- **Port/interface:** contrato público versionado implementado por adapter injetado.
- **Evento:** ID, versão, payload tipado, producer/consumer, idempotência, retries e compatibilidade.
- **Capabilities:** DECLARADA / IMPLEMENTADA / TESTADA / INTEGRADA / DISPONÍVEL / HABILITADA / ACEITA.
- **Infra:** configuration as code, rede, roles, políticas e restore; não presumir interface TS.
- **Qualidade:** suites, gates, entradas e evidências do pipeline.

## Dependências e importações
Antes de introduzir dependência ou biblioteca: conferir código próprio, `package.json`, pacotes já disponíveis em `packages/`, e interfaces públicas das unidades proprietárias. Uma dependência nova requer justificativa; uma dependência privada de outro módulo é proibida.

**Alterações aditivas preferenciais:** adicionar interface/coluna/evento não garante compatibilidade por si só. Preservar consumidores, compatibilidade de schemas e limites de autorização; testar comportamento em módulos interessados. Remoções requerem migração e aprovação expressa.

## Configuração e segredos
Documentar nomes reais das variáveis verificadas no código e responsáveis por sua injeção. **Nunca** publicar valores, secrets, DSN de tenant, tokens, endpoints administrativos privados ou dados pessoais em Markdown.
