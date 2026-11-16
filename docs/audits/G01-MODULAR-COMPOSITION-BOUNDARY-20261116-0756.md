# G01 — Limites de composição modular (auditoria estática)

Data: 2026-11-16. Baseline de leitura: `1cf48cc0a1281017ac58f7b9b9747f663109e151` (main consultada novamente antes da escrita). Owner: G01 Arquitetura, catálogo `catalog/work-units.json`. Este documento é evidência de inspeção, não aceite operacional.

## Contratos confrontados

- Público: `AGENTS.md`, `docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md`, `docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md`, `packages/core-kernel/README.md`.
- Código: `packages/core-kernel/src/index.ts`, `module-registry.ts`, `module-access.ts`; `apps/core-host/src/module-host.ts`, `config/modules.json`, `package.json`, `src/module-installer.ts`.
- Registry valida IDs, versões, schemas e dependências/ciclos; loader limita specifiers a pacotes `@syndes/*/plugin`, valida identidade e conflitos de rotas de assets. `requireModuleAccess` falha fechado quando o port falta/nega, mas só protege operações que o Host efetivamente encaminha pelo gate.

## Constatações e fronteiras

**G01-CMP-01 — composição por perfil ainda não implementada (lacuna assumida, não regressão).** `config/modules.json` contém lista fixa CRM, Inbox, WhatsApp, Organizations e Support; `package.json` também inclui Service como dependência, mas o plugin Service não consta na lista instalada. A presença do pacote no build não prova montagem, ENABLED, migrations aplicadas ou uso operacional. O ADR CMP explicita que perfis versionados, imagens seletivas e ownership de workers entre instâncias são futuros; não declarar dois perfis em execução.

**G01-GATE-02 — cobertura de autorização depende de todos os entrypoints.** O contrato do Kernel é explícito: `requireModuleAccess` não substitui membership, escopo e FGA e não intercepta rotas automaticamente. A inspeção do loader e do port não prova que cada controller, job e evento use o gate. Inventário de entrypoints e testes negativos por módulo permanecem pendentes; não inferir vulnerabilidade explorável apenas desta ausência de comprovação.

**G01-BOUNDARY-03 — instalação e ativação não equivalem a montagem de plugin.** `PgModuleInstaller` está definido no Core Host como mecanismo operator-only, com manifest confiável, checksums e validações de ledger/DB; comentário declara que não é ligado ao Nest/HTTP/worker. Não executar `apply` nem inferir migrations operacionais a partir do código. Os contratos de eventos estão exportados em `core-kernel/src/index.ts`, mas esta inspeção não validou schemas/event consumers nem persistência operacional.

## Evidências não produzidas

Nenhum teste unitário, integração, browser, SQL, migration, build, workflow, deployment ou operação em DevServer01 foi executado. Nenhum resultado de CI por SHA, instalação real, homologação, gates de segurança ou SHA publicado do GitHub Pages foi confirmado. O catálogo possui 57 unidades de ownership; este checkpoint não reconcilia as demais nem inventaria todos os owners descobertos. Comparar a matriz real de controllers/jobs/consumers e respectivos testes antes de concluir G01. Pendências de Q07/Q08/I11 permanecem independentes.

## Regra de publicação

Branch exclusiva de auditoria; somente este Markdown. Não modificar `main`, código, workflows, documentação de outros owners ou branches concorrentes. Revisão e integração ficam sujeitas a comparação com a main atual e gates próprios.
