# A03 — Support Frontend: auditoria estática de fronteiras (2026-11-16)

Base canônica consultada: `main` em `1cf48cc0a1281017ac58f7b9b9747f663109e151`. Escopo: `apps/support-web/src/{App,api,auth}.ts*`, `apps/support-web/{README.md,package.json,e2e/support.spec.mjs}`, `modules/support/{README.md,package.json}`, `docs/product/PRD-SYNDES-SUPPORT.md` e `docs/engineering/SYNDES-SUPPORT-RELEASE-GATE.md`.

## Contratos e evidências

- O PRD SUP-01–SUP-11 delimita tenant operacional Syndes, chamados internos/externos, filas, permissões, notas privadas e ausência de criação anônima. A API do frontend implementa GET list/detail/events, POST internal/external/notes, PATCH status/assignment/queue, além da consulta Inbox. `App.tsx` implementa listas, detalhes, criação, operações e invalidação de leituras/ações ao trocar público.
- `auth.ts` exige configuração HTTPS, client ID `syndes-support-ui`, UUID de tenant e executa authorization code com PKCE S256 e verificação de state/expiração. `api.ts` envia bearer, reage a 401 e mostra 403/409. Autorização real, `azp`, audience, associação de filas e isolamento de tenant são responsabilidades server-side; não podem ser inferidas do filtro da UI.
- `support.spec.mjs` declara Playwright com Keycloak, PostgreSQL e OpenFGA reais em infraestrutura descartável, cobrindo 401 anônimo, cliente errado, permissões, notas privadas, criação externa e respostas atrasadas. É evidência de **existência de teste**, não de execução/aprovação no SHA atual.
- O frontend não contém migrations nem emissão de eventos de domínio próprios; o histórico é consumido por GET `/events`. SQL/migrations, atomicidade do histórico, persistência e callbacks externos pertencem ao módulo/backend e **não foram auditados integralmente neste checkpoint**.
- `modules/support/package.json` declara `npm test` com build prévio: não é execução somente leitura. Nenhum comando foi executado.

## Divergências e limites

1. **A03-AUTH-01 — Logout local versus sessão federada:** `App.tsx` chama `markSignedOut()` e remove token da memória; `auth.ts` não chama endpoint de encerramento de sessão Keycloak. Reentrada manual pode reutilizar SSO existente. Confirmar requisito de logout global antes de classificar como defeito.
2. **A03-TEST-02 — Evidência de teste ≠ gate aprovado:** o E2E real é declarado, mas este checkpoint não verifica runs de Actions, resultado por SHA nem homologação. A aprovação do release exige evidências operacionais adicionais.
3. **A03-BOUNDARY-03 — Proteção de tenant e notas é backend:** validações de `kind` e cancelamento de requests na UI reduzem exposição acidental, mas não demonstram autorização no Host, invariantes SQL ou ausência de outbound de notas; exigem inspeção independente.
4. **A03-STATUS-04 — Estado documental:** PRD ainda diz “contrato proposto em branch isolada” enquanto o README raiz declara Support integrado à main. A formulação do PRD está desatualizada para existência de fonte, sem implicar homologação. O release gate permanece explicitamente BLOCKED.

## Limites e próximos gates

Não foram executados testes, build, Docker, SQL, migrations, CI/workflows, deploy ou acesso ao DevServer. Não foram consultados segredos ou credenciais. Nenhum código de produto ou branch alheia foi alterado. Validar posteriormente API/controller/guards do backend, eventos e migrations, rastrear Actions por SHA, reconciliar PRD/status e evidenciar smoke operacional antes de qualquer homologação. Este checkpoint não afirma que as 57 unidades e owners adicionais estejam reconciliados, nem divergências zero ou GitHub Pages publicado por SHA.
