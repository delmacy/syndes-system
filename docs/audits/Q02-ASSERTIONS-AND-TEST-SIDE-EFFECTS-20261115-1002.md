# Q02 — Testes unitários: assertions e efeitos de execução (15/11/2026 10:02 BRT)

- Owner: Q02; baseline GitHub `main` `1cf48cc0a1281017ac58f7b9b9747f663109e151`.
- Continuação do checkpoint `audit/q02-unit-contract-boundaries-20261114-1456`, sem sobrescrevê-lo.
- Método: leitura estática via GitHub MCP. Nenhum teste, build, SQL, migration, deploy ou DevServer executado.

## Contratos e implementação observados

1. `modules/core-crm/package.json` exporta `.` e `./plugin`; `test` executa `npm run build && node --test test/*.test.mjs`; `check` usa `tsc --noEmit`. O build escreve `dist`, portanto **o script test não é estritamente read-only** em um ambiente com `dist` publicado/montado. Não inferir que o build alterou produção: nenhum ambiente foi consultado.
2. `modules/support/package.json` repete a convenção build + node --test; exports `.` e `./plugin`. `apps/core-host/package.json` acrescenta `link-peers` antes do build, potencialmente alterando links locais. A classificação de segurança depende do ambiente e não deve ser deduzida do nome `test`.
3. `apps/core-host/test/module-installer.test.mjs` importa `PgModuleInstaller` de `dist` (implementação privada, não API pública), exercita rejeição de manifest inválido, versões, checksum, escopo SQL, duplicidade e módulo não confiável. Usa DB e resolver simulados; não prova execução real de migrations ou PostgreSQL.
4. `modules/support/test/security.test.mjs` importa `SupportService` e `SupportInputError` de `dist` (classes internas sob teste), e `AccessDeniedError` de `@syndes/core-kernel` (dependência pública). As assertions negativas cobrem tenant incorreto, FGA negado/indisponível, banco divergente, entradas inválidas, filtro de filas, histórico e permissões Inbox/CRM; usa mocks para banco, kernel e provider. Não demonstra FGA real, SQL aplicado, tenant isolation operacional nem integração E2E.
5. `scripts/architecture/check-work-units.mjs` verifica 57 entradas e caminhos existentes no catálogo, com maturidades aceitas; não verifica cobertura de testes ou resultado de CI. `docs/subprojects/Q02-testes-unitarios/STATUS.md` ainda classifica o material como documentação-base sem auditoria funcional, enquanto há assertions concretas distribuídas por módulos. Não promover automaticamente status por mera existência.

## Fronteiras e lacunas

- Q02 é responsabilidade transversal de suites. Não foi identificada API HTTP, consumer, evento, schema ou migration **próprios de Q02** nos arquivos lidos; APIs/eventos/tabelas reais pertencem aos owners sob teste.
- Testes de migrations e integração PG presentes no repositório não foram executados nem contabilizados como testes unitários; nenhum resultado PASS/FAIL do SHA foi obtido.
- Risco documental Q02-01: classificar `npm test` como auditoria somente leitura é incorreto sem inspecionar efeitos do build e `link-peers` no ambiente. Esse risco é distinto do I06-TEST-01, mas relacionado.
- Q02-02: matriz de cobertura de assertions por contrato, API, evento, migration e owner permanece incompleta; fixtures/mock não substituem evidência operacional.
- Q02-03: `STATUS.md` e referência técnica não refletem ainda a distribuição real de testes e seus limites. Correção deve ser feita pelo responsável documental, sem disputa de arquivos nesta branch.

## Evidências e gates

Fonte/assinaturas/scripts: **inspecionados na amostra**; assertions negativas: **lidas estaticamente**; testes executados nesta rodada: **zero**; CI para baseline: **não consultada**; deploy/homologação: **não comprovados**; GitHub Pages SHA público: **não confirmado**. Inventário global dos 57 owners e owners adicionais **não reconciliado** nesta rodada.

Checkpoint isolado: nenhuma mudança em runtime, SQL, migrations, workflows, CI, secrets, outras branches ou ambiente operacional. Não autoriza merge nem promoção de maturidade. Próximo passo: auditar Q03/Q04 em profundidade ou consolidar matriz Q02 por owner com evidências de CI vinculadas a SHA.
