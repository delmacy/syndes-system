# A02 — Platform Manager Frontend | checkpoint de auditoria estática (2026-11-16 09:02 BRT)

Base consultada via GitHub MCP: `main@1cf48cc0a1281017ac58f7b9b9747f663109e151`. Owner: `A02` (`apps/master-admin-web`), conforme `catalog/work-units.json`. Este checkpoint não altera o STATUS oficial nem constitui aceite.

## Contrato público versus código privado
- `docs/subprojects/A02-platform-manager-frontend/STATUS.md` e `REFERENCIA-TECNICA.md` declaram documentação-base sem auditoria funcional. Entretanto, `src/App.tsx` implementa login, visão geral, diretório de clientes, filtros e drawer; `src/api.ts` tipa e chama endpoints GET; `src/auth.ts` implementa OIDC authorization code + PKCE S256. **A02-DOC-01:** status documental ainda não diferencia essas capacidades codificadas de testes aprovados e homologação.
- `src/api.ts` chama `/v1/platform/admin/me`, `/summary`, `/tenants`, `/tenants/:id` e `/tenants/:id/modules`. `apps/master-admin-api/src/server.mjs` reconhece essas rotas GET, exige token verificado e vínculo ativo em `platform_operator_access`, e responde com metadados do Control Plane. O frontend não exporta API HTTP própria; tipos e `MasterApi` são clientes internos, não contratos públicos de módulos.
- `src/features/tenants/ClientDrawer.tsx` consulta detalhe e inventário de módulos em paralelo, mas apresenta concessão/instalação/suspensão como indisponíveis. O handler da API não possui rotas de escrita. Não confundir visualização de inventário com comando administrativo implantado.
- `src/auth.ts` mantém estado/verifier PKCE temporário em sessionStorage, valida state e janela de cinco minutos; `App.tsx` faz logout local via `clearLogin()`, sem redirecionar ao endpoint de logout federado. **A02-AUTH-02:** saída da interface não demonstra encerramento da sessão no IdP. O token permanece apenas em estado React durante a sessão da página.
- `App.tsx` contém `VITE_DEMO_PREVIEW` que seleciona `DemoMasterApi` e token fictício. **A02-PREVIEW-03:** verificar separação de build/ambiente e ausência desse modo no release operacional antes de homologar; não há evidência aqui de preview implantado em produção.

## APIs, dados, eventos e limites
- O backend `apps/master-admin-api/src/main.mjs` configura pool PostgreSQL com `default_transaction_read_only=on` e verifica banco `syndes_control` e role dedicada `syndes_master_api`. `server.mjs` lê `tenant_registry`, `tenant_memberships`, `platform_operator_access`, `platform_tenant_profiles`. A02 consome dados via API A05; não possui migrations próprias identificadas nos arquivos inspecionados. **Não foi auditado** o DDL/migration owner nem grants reais/aplicação.
- Nenhum produtor/consumidor de evento foi encontrado nos entrypoints A02 inspecionados; isso não comprova ausência em todo o repositório. Sem prova de runtime, autorização operacional, rede, identidade real ou tenants reais.

## Testes e evidência
- `package.json` declara `test` (Node tests locais e front-shared), `test:browser` (Playwright) e `build` (TypeScript/Vite). `tests/browser-e2e.mjs` usa browser real mas intercepta OIDC, token e endpoints com fixtures; cobre PKCE, overview, filtros, detalhes, logout local e acesso negado. O fixture não retorna `/tenants/:id/modules` (404) e o teste não afirma conteúdo do inventário. **A02-TEST-04:** não usar esse E2E como prova de integração real de inventário, Keycloak, PostgreSQL, OpenFGA ou deploy.
- Não executados: testes unitários, browser E2E, build, migrations, SQL, CI, workflow, deploy, inspeção DevServer. Não foram consultados resultados Actions por SHA nem SHA publicado de GitHub Pages.

## Reconciliação e continuidade
- Contrato documental A02 permanece preliminar; fonte existe e contém telas/rotas de leitura. Testes declarados **não** equivalem a testes aprovados; código integrado **não** equivale a ambiente implantado/homologado.
- Próximo owner A03 Support Frontend, após verificar branches/checkpoints atuais. Reconciliar A02-DOC-01, A02-AUTH-02, A02-PREVIEW-03 e A02-TEST-04 com o owner documental, sem sobrescrever branches concorrentes.
- Escopo desta inspeção: arquivos `catalog/work-units.json`, `docs/subprojects/A02-platform-manager-frontend/{STATUS,REFERENCIA-TECNICA,ESCOPO}.md`, `apps/master-admin-web/{package.json,src/App.tsx,src/api.ts,src/auth.ts,src/features/tenants/ClientDrawer.tsx,tests/browser-e2e.mjs}`, `apps/master-admin-api/{package.json,src/main.mjs,src/server.mjs}`. Não é auditoria exaustiva das 57 unidades; divergências globais, gates de review e Pages SHA permanecem não comprovados.
